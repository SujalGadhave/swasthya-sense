import express from 'express';
import crypto from 'crypto';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/logAudit.js';
import { evaluateRules } from '../rules/evaluator.js';
import rulesConfig from '../rules/rules.json' with { type: 'json' };

const router = express.Router();

/**
 * POST /api/checkins
 * Records a new completed check-in, runs pure rule evaluation,
 * registers any flags, automatically schedules the next follow-up date,
 * and writes to audit_log inside a single transaction.
 */
router.post('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  const {
    patient_id,
    client_uuid = null,
    channel = 'in_person',
    symptoms = [],
    measurements = {},
    notes = '',
    existing_check_in_id = null
  } = req.body;

  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  // Input sanity validation
  if (measurements && typeof measurements === 'object') {
    if (measurements.systolic !== undefined && measurements.systolic !== null && measurements.systolic !== '') {
      const sys = Number(measurements.systolic);
      if (isNaN(sys) || sys < 30 || sys > 350) {
        return res.status(400).json({ error: 'Invalid systolic blood pressure value' });
      }
    }
    if (measurements.diastolic !== undefined && measurements.diastolic !== null && measurements.diastolic !== '') {
      const dia = Number(measurements.diastolic);
      if (isNaN(dia) || dia < 20 || dia > 250) {
        return res.status(400).json({ error: 'Invalid diastolic blood pressure value' });
      }
    }
  }

  // Idempotency check: if client_uuid is provided, check if already processed (uses pool directly)
  if (client_uuid) {
    const [existingRows] = await pool.query(
      'SELECT * FROM check_ins WHERE client_uuid = ?',
      [client_uuid]
    );
    if (existingRows.length > 0) {
      const existingCheckIn = existingRows[0];
      const [existingFlags] = await pool.query(
        'SELECT * FROM flags WHERE check_in_id = ?',
        [existingCheckIn.id]
      );
      return res.status(200).json({
        success: true,
        already_processed: true,
        checkInId: existingCheckIn.id,
        flags: existingFlags,
        nextDueDate: existingCheckIn.due_date,
        message: 'Check-in was previously recorded (idempotent duplicate rejected)'
      });
    }
  }

  const conn = await pool.getConnection();
  let inTransaction = false;

  try {
    await conn.beginTransaction();
    inTransaction = true;

    // 1. Fetch patient metadata
    const [patientRows] = await conn.query('SELECT * FROM patients WHERE id = ? FOR UPDATE', [patient_id]);
    if (patientRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientRows[0];

    // 2. Fetch cohort schedule
    const [scheduleRows] = await conn.query('SELECT * FROM schedules WHERE cohort = ?', [patient.cohort]);
    const schedule = scheduleRows[0] || { interval_days: 30, grace_period_days: 3, reminder_lead_time_days: 2 };

    // 3. Fetch past completed check-ins for trend evaluation (e.g. R5 rising BP)
    const [pastRows] = await conn.query(
      `SELECT * FROM check_ins 
       WHERE patient_id = ? AND completed_at IS NOT NULL 
       ORDER BY completed_at DESC LIMIT 5`,
      [patient_id]
    );

    // 4. Mark existing pending check-in completed OR create new completed check-in
    const checkInId = existing_check_in_id || crypto.randomUUID();
    const todayStr = new Date().toISOString().split('T')[0];

    if (existing_check_in_id) {
      await conn.query(
        `UPDATE check_ins 
         SET client_uuid = COALESCE(?, client_uuid), completed_at = NOW(), channel = ?, symptoms = ?, measurements = ?, notes = ?
         WHERE id = ?`,
        [client_uuid, channel, JSON.stringify(symptoms), JSON.stringify(measurements), notes, existing_check_in_id]
      );
    } else {
      await conn.query(
        `INSERT INTO check_ins (id, client_uuid, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [
          checkInId,
          client_uuid,
          patient_id,
          req.user.id,
          todayStr,
          channel,
          JSON.stringify(symptoms),
          JSON.stringify(measurements),
          notes
        ]
      );
    }

    // 5. Evaluate clinical & data-quality rules via pure function
    const currentCheckInData = {
      id: checkInId,
      due_date: todayStr,
      completed_at: new Date(),
      symptoms,
      measurements
    };

    const triggeredFlags = evaluateRules({
      checkIn: currentCheckInData,
      patient,
      pastCheckIns: pastRows,
      schedule,
      rulesConfig,
      referenceDate: new Date()
    });

    const insertedFlags = [];

    // 6. Persist triggered flags (R4-R8)
    for (const flag of triggeredFlags) {
      const flagId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
        [
          flagId,
          checkInId,
          patient_id,
          flag.type,
          flag.rule_id,
          JSON.stringify(flag.triggering_values),
          flag.severity,
          flag.rule_version
        ]
      );

      insertedFlags.push({
        id: flagId,
        ...flag
      });

      await logAudit(conn, {
        userId: req.user.id,
        role: req.user.role,
        action: 'FLAG_GENERATED',
        entityType: 'flag',
        entityId: flagId,
        metadata: {
          ruleId: flag.rule_id,
          type: flag.type,
          severity: flag.severity,
          explanation: flag.explanation
        }
      });
    }

    // 7. Schedule next routine follow-up check-in based on cohort interval_days
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + (schedule.interval_days || 30));
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const nextCheckInId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
       VALUES (?, ?, ?, ?, NULL, ?, '[]', '{}', 'Routine follow-up automatically scheduled')`,
      [nextCheckInId, patient_id, req.user.id, nextDueDateStr, channel]
    );

    // 8. Log CHECKIN_RECORDED (or CHECKIN_OFFLINE_SYNCED) to audit_log
    const isOfflineSync = Boolean(req.body.is_offline_sync);
    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: isOfflineSync ? 'CHECKIN_OFFLINE_SYNCED' : 'CHECKIN_RECORDED',
      entityType: 'check_in',
      entityId: checkInId,
      metadata: {
        patientId: patient_id,
        flagsCount: insertedFlags.length,
        flagsGenerated: insertedFlags.map(f => f.rule_id),
        nextDueDate: nextDueDateStr,
        offlineSync: isOfflineSync,
        offlineQueuedAt: req.body.offline_queued_at || null
      }
    });

    await conn.commit();
    inTransaction = false;

    res.status(201).json({
      success: true,
      checkInId,
      flags: insertedFlags,
      nextDueDate: nextDueDateStr
    });
  } catch (error) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('[CheckIn Submit Error]', error);
    res.status(500).json({ error: 'Failed to record check-in and evaluate rules' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/checkins/patient/:patientId
 * Returns completed check-in history for a patient.
 */
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { patientId } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM check_ins 
       WHERE patient_id = ? 
       ORDER BY completed_at DESC, due_date DESC`,
      [patientId]
    );

    res.json({ checkIns: rows });
  } catch (error) {
    console.error('[CheckIn History Error]', error);
    res.status(500).json({ error: 'Failed to fetch check-in history' });
  }
});

export default router;

