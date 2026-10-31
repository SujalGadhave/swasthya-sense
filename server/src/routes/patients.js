import express from 'express';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/logAudit.js';

const router = express.Router();

/**
 * GET /api/patients/call-list
 * Returns prioritized morning call list for frontline health workers.
 * Priority: 1. Clinical Alerts > 2. Repeated Missed (R3) > 3. Overdue (R2) > 4. Due Soon (R1)
 */
router.get('/call-list', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const filter = req.query.filter || 'all'; // all | concerning | overdue | escalated

    let workerClause = '';
    const queryParams = [];

    if (req.user.role === 'worker') {
      workerClause = 'AND p.assigned_worker_id = ?';
      queryParams.push(req.user.id);
    }

    // Query active pending check-ins and associated flags
    const [rows] = await pool.query(
      `SELECT 
        p.id AS patient_id,
        p.pseudonym,
        p.age_band,
        p.village_or_ward,
        p.cohort,
        p.consent_status,
        p.abha_id,
        c.id AS check_in_id,
        c.due_date,
        c.channel,
        DATEDIFF(CURRENT_DATE, c.due_date) AS days_overdue,
        f.id AS flag_id,
        f.rule_id,
        f.type AS flag_type,
        f.severity AS flag_severity,
        f.status AS flag_status,
        f.triggering_values,
        e.id AS escalation_id,
        e.status AS escalation_status
       FROM patients p
       LEFT JOIN check_ins c ON c.patient_id = p.id AND c.completed_at IS NULL
       LEFT JOIN flags f ON f.patient_id = p.id AND f.status IN ('active', 'escalated')
       LEFT JOIN escalations e ON e.flag_id = f.id AND e.status IN ('pending', 'reviewed')
       WHERE 1=1 ${workerClause}
       ORDER BY p.id`,
      queryParams
    );

    // Group flags per patient to determine top priority
    const patientMap = new Map();

    for (const row of rows) {
      if (!patientMap.has(row.patient_id)) {
        patientMap.set(row.patient_id, {
          patient_id: row.patient_id,
          pseudonym: row.pseudonym,
          age_band: row.age_band,
          village_or_ward: row.village_or_ward,
          cohort: row.cohort,
          consent_status: row.consent_status,
          abha_id: row.abha_id,
          check_in_id: row.check_in_id,
          due_date: row.due_date ? (row.due_date instanceof Date ? row.due_date.toISOString().split('T')[0] : String(row.due_date)) : null,
          channel: row.channel,
          days_overdue: row.days_overdue || 0,
          flags: [],
          escalation_id: row.escalation_id,
          escalation_status: row.escalation_status
        });
      }

      const pEntry = patientMap.get(row.patient_id);
      if (row.flag_id) {
        const flagExists = pEntry.flags.some(f => f.id === row.flag_id);
        if (!flagExists) {
          pEntry.flags.push({
            id: row.flag_id,
            rule_id: row.rule_id,
            type: row.flag_type,
            severity: row.flag_severity,
            status: row.flag_status,
            triggering_values: typeof row.triggering_values === 'string'
              ? JSON.parse(row.triggering_values)
              : row.triggering_values
          });
        }
      }
      if (row.escalation_id) {
        pEntry.escalation_id = row.escalation_id;
        pEntry.escalation_status = row.escalation_status;
      }
    }

    const callList = Array.from(patientMap.values()).map(p => {
      let priorityRank = 5; // default routine
      let priorityLabel = 'Routine Follow-up';

      const hasClinicalAlert = p.flags.some(f => f.type === 'clinical' && f.status !== 'resolved');
      const hasR3 = p.flags.some(f => f.rule_id === 'R3');
      const hasR2 = p.flags.some(f => f.rule_id === 'R2');
      const hasR1 = p.flags.some(f => f.rule_id === 'R1');

      if (hasClinicalAlert) {
        priorityRank = 1;
        priorityLabel = 'Clinical Alert';
      } else if (hasR3) {
        priorityRank = 2;
        priorityLabel = 'Repeated Missed Follow-up';
      } else if (hasR2) {
        priorityRank = 3;
        priorityLabel = 'Overdue Follow-up';
      } else if (hasR1) {
        priorityRank = 4;
        priorityLabel = 'Visit Due Soon';
      }

      return {
        ...p,
        priorityRank,
        priorityLabel
      };
    });

    // Sort by proximity (village ward route) OR by urgency priority rank
    const sortBy = req.query.sort || 'urgency';
    if (sortBy === 'proximity') {
      callList.sort((a, b) => {
        const wardDiff = (a.village_or_ward || '').localeCompare(b.village_or_ward || '');
        if (wardDiff !== 0) return wardDiff;
        return a.priorityRank - b.priorityRank;
      });
    } else {
      callList.sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) {
          return a.priorityRank - b.priorityRank;
        }
        return b.days_overdue - a.days_overdue;
      });
    }

    // Apply optional filter
    let filteredList = callList;
    if (filter === 'concerning') {
      filteredList = callList.filter(p => p.priorityRank === 1);
    } else if (filter === 'overdue') {
      filteredList = callList.filter(p => p.priorityRank === 2 || p.priorityRank === 3);
    } else if (filter === 'escalated') {
      filteredList = callList.filter(p => p.escalation_status && p.escalation_status !== 'closed');
    }

    res.json({
      totalCount: filteredList.length,
      filter,
      patients: filteredList
    });
  } catch (error) {
    console.error('[Call List Error]', error);
    res.status(500).json({ error: 'Failed to retrieve prioritized call list' });
  }
});

/**
 * GET /api/patients
 * Lists patients. Workers see assigned patients; Clinicians & Supervisors can view all.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    let query = `
      SELECT id, pseudonym, age_band, village_or_ward, cohort, assigned_worker_id, consent_status, abha_id, consent_updated_at, created_at
      FROM patients
    `;
    const params = [];

    if (req.user.role === 'worker') {
      query += ' WHERE assigned_worker_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY pseudonym ASC';
    const [rows] = await pool.query(query, params);
    res.json({ patients: rows });
  } catch (error) {
    console.error('[Patients List Error]', error);
    res.status(500).json({ error: 'Failed to retrieve patient registry' });
  }
});

/**
 * GET /api/patients/:id
 * Returns patient profile, past check-ins, and active/resolved flags.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [patientRows] = await pool.query(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    if (patientRows.length === 0) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    const patient = patientRows[0];

    // Worker role barrier
    if (req.user.role === 'worker' && patient.assigned_worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to unassigned patient record' });
    }

    const [checkInRows] = await pool.query(
      `SELECT * FROM check_ins WHERE patient_id = ? ORDER BY due_date DESC`,
      [id]
    );

    const [flagRows] = await pool.query(
      `SELECT * FROM flags WHERE patient_id = ? ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      patient,
      checkIns: checkInRows,
      flags: flagRows
    });
  } catch (error) {
    console.error('[Patient Detail Error]', error);
    res.status(500).json({ error: 'Failed to retrieve patient details' });
  }
});

/**
 * PATCH /api/patients/:id/consent
 * Toggles or updates consent status ('consented' <-> 'declined').
 * Executed in transaction with audit logging.
 */
router.patch('/:id/consent', authenticateToken, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { id } = req.params;
    const { consent_status } = req.body;

    if (!['consented', 'declined'].includes(consent_status)) {
      return res.status(400).json({ error: "Invalid consent status. Allowed: 'consented', 'declined'" });
    }

    await conn.beginTransaction();

    const [patientRows] = await conn.query('SELECT * FROM patients WHERE id = ? FOR UPDATE', [id]);
    if (patientRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientRows[0];
    const previousStatus = patient.consent_status;

    await conn.query(
      'UPDATE patients SET consent_status = ?, consent_updated_at = NOW() WHERE id = ?',
      [consent_status, id]
    );

    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: 'CONSENT_STATUS_UPDATED',
      entityType: 'patient',
      entityId: id,
      metadata: { previousStatus, newStatus: consent_status }
    });

    await conn.commit();

    res.json({
      success: true,
      patientId: id,
      previousStatus,
      newStatus: consent_status
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Consent Update Error]', error);
    res.status(500).json({ error: 'Failed to update patient consent' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/patients/:id/trends
 * Returns chronological vitals history for trend visualization (e.g. sparklines).
 */
router.get('/:id/trends', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [patientRows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
    if (patientRows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientRows[0];

    const [checkinRows] = await pool.query(
      `SELECT id, due_date, completed_at, measurements, symptoms 
       FROM check_ins 
       WHERE patient_id = ? AND completed_at IS NOT NULL 
       ORDER BY completed_at ASC LIMIT 10`,
      [id]
    );

    const trends = checkinRows.map((c) => {
      const m = typeof c.measurements === 'string'
        ? JSON.parse(c.measurements || '{}')
        : (c.measurements || {});
      const s = typeof c.symptoms === 'string'
        ? JSON.parse(c.symptoms || '[]')
        : (c.symptoms || []);

      return {
        check_in_id: c.id,
        date: c.completed_at
          ? (c.completed_at instanceof Date ? c.completed_at.toISOString().split('T')[0] : String(c.completed_at).split('T')[0])
          : null,
        systolic: m.systolic ? Number(m.systolic) : null,
        diastolic: m.diastolic ? Number(m.diastolic) : null,
        fastingGlucose: m.fastingGlucose ? Number(m.fastingGlucose) : null,
        randomGlucose: m.randomGlucose ? Number(m.randomGlucose) : null,
        heartRate: m.heartRate ? Number(m.heartRate) : null,
        spo2: m.spo2 ? Number(m.spo2) : null,
        weightKg: m.weightKg ? Number(m.weightKg) : null,
        symptoms: s
      };
    });

    res.json({
      patient_id: patient.id,
      pseudonym: patient.pseudonym,
      cohort: patient.cohort,
      abha_id: patient.abha_id,
      trends
    });
  } catch (error) {
    console.error('[Patient Trends Error]', error);
    res.status(500).json({ error: 'Failed to retrieve patient vital trends' });
  }
});

/**
 * GET /api/patients/:id/fhir
 * Generates an Ayushman Bharat Digital Mission (ABDM) compliant HL7 FHIR R4 Document Bundle.
 */
router.get('/:id/fhir', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [patientRows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
    if (patientRows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientRows[0];

    const [checkinRows] = await pool.query(
      `SELECT * FROM check_ins 
       WHERE patient_id = ? AND completed_at IS NOT NULL 
       ORDER BY completed_at DESC LIMIT 5`,
      [id]
    );

    const [flagRows] = await pool.query(
      `SELECT * FROM flags WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    const entries = [];

    // 1. FHIR Patient Resource
    entries.push({
      fullUrl: `urn:uuid:${patient.id}`,
      resource: {
        resourceType: 'Patient',
        id: patient.id,
        meta: {
          profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
        },
        identifier: [
          {
            system: 'https://healthid.ndhm.gov.in',
            type: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }]
            },
            value: patient.abha_id || `ABHA-TEMP-${patient.id.substring(0, 8)}`
          }
        ],
        active: true,
        name: [{ text: patient.pseudonym }],
        address: [
          {
            use: 'home',
            text: patient.village_or_ward,
            district: 'Sitapur',
            state: 'Uttar Pradesh',
            country: 'IND'
          }
        ],
        extension: [
          {
            url: 'https://swasthyasense.nhm.gov.in/fhir/StructureDefinition/cohort',
            valueString: patient.cohort
          },
          {
            url: 'https://swasthyasense.nhm.gov.in/fhir/StructureDefinition/dpdp-consent',
            valueString: patient.consent_status
          }
        ]
      }
    });

    // 2. Observations for each completed check-in vitals
    for (const c of checkinRows) {
      const m = typeof c.measurements === 'string' ? JSON.parse(c.measurements || '{}') : (c.measurements || {});
      const effectiveDateTime = c.completed_at ? new Date(c.completed_at).toISOString() : new Date().toISOString();

      if (m.systolic && m.diastolic) {
        entries.push({
          fullUrl: `urn:uuid:obs-bp-${c.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-bp-${c.id}`,
            status: 'final',
            category: [{
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }]
            }],
            code: {
              coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
              text: 'Blood pressure systolic & diastolic'
            },
            subject: { reference: `urn:uuid:${patient.id}`, display: patient.pseudonym },
            effectiveDateTime,
            component: [
              {
                code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
                valueQuantity: { value: Number(m.systolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
              },
              {
                code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
                valueQuantity: { value: Number(m.diastolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
              }
            ]
          }
        });
      }

      if (m.fastingGlucose || m.randomGlucose) {
        const glucVal = Number(m.fastingGlucose || m.randomGlucose);
        const isFasting = Boolean(m.fastingGlucose);
        entries.push({
          fullUrl: `urn:uuid:obs-glu-${c.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-glu-${c.id}`,
            status: 'final',
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: isFasting ? '1558-6' : '2339-0',
                display: isFasting ? 'Fasting glucose in Blood' : 'Glucose in Blood'
              }],
              text: isFasting ? 'Fasting Blood Glucose' : 'Random Blood Glucose'
            },
            subject: { reference: `urn:uuid:${patient.id}` },
            effectiveDateTime,
            valueQuantity: { value: glucVal, unit: 'mg/dL', system: 'http://unitsofmeasure.org', code: 'mg/dL' }
          }
        });
      }
    }

    // 3. RiskAssessment Resources for Active Flags
    for (const f of flagRows) {
      entries.push({
        fullUrl: `urn:uuid:risk-${f.id}`,
        resource: {
          resourceType: 'RiskAssessment',
          id: `risk-${f.id}`,
          status: 'final',
          subject: { reference: `urn:uuid:${patient.id}` },
          occurrenceDateTime: new Date(f.created_at).toISOString(),
          prediction: [
            {
              outcome: { text: `Rule ${f.rule_id} Alert: ${f.severity}` },
              qualitativeRisk: {
                coding: [{ system: 'http://terminology.hl7.org/CodeSystem/risk-probability', code: f.severity }]
              }
            }
          ],
          note: [{ text: 'Generated by Swasthya Sense deterministic rule engine. Illustrative, requires clinician sign-off.' }]
        }
      });
    }

    const fhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-swasthya-${patient.id}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
      },
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries
    };

    res.json(fhirBundle);
  } catch (error) {
    console.error('[FHIR Export Error]', error);
    res.status(500).json({ error: 'Failed to generate ABDM FHIR R4 Bundle' });
  }
});

export default router;

