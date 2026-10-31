import express from 'express';
import crypto from 'crypto';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { logAudit } from '../middleware/logAudit.js';

const router = express.Router();

/**
 * POST /api/escalations
 * Health worker escalates a clinical alert to a named clinician.
 * Updates flag status to 'escalated' and records in audit_log inside transaction.
 */
router.post('/', authenticateToken, requireRole(['worker', 'supervisor']), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const {
      flag_id,
      to_clinician_id,
      worker_note = '',
      referral_facility = 'Govt Primary Health Centre (PHC Sitapur)'
    } = req.body;

    if (!flag_id) {
      return res.status(400).json({ error: 'Flag ID is required for escalation' });
    }

    await conn.beginTransaction();

    const [flagRows] = await conn.query('SELECT * FROM flags WHERE id = ? FOR UPDATE', [flag_id]);
    if (flagRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Target flag not found' });
    }

    const flag = flagRows[0];
    if (flag.type !== 'clinical') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only clinical alerts can be escalated to a clinician' });
    }

    // Default to first clinician if not specified
    let targetClinicianId = to_clinician_id;
    if (!targetClinicianId) {
      const [clinicianRows] = await conn.query("SELECT id FROM users WHERE role = 'clinician' LIMIT 1");
      targetClinicianId = clinicianRows[0]?.id || null;
    }

    const escalationId = crypto.randomUUID();
    const initialOutcome = `Referred to ${referral_facility}`;

    await conn.query(
      `INSERT INTO escalations (id, flag_id, from_worker_id, to_clinician_id, status, clinician_note, outcome, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', NULL, ?, NOW(), NOW())`,
      [escalationId, flag_id, req.user.id, targetClinicianId, initialOutcome]
    );

    await conn.query("UPDATE flags SET status = 'escalated' WHERE id = ?", [flag_id]);

    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: 'FLAG_ESCALATED_GOVT_HOSPITAL',
      entityType: 'escalation',
      entityId: escalationId,
      metadata: {
        flagId: flag_id,
        ruleId: flag.rule_id,
        toClinicianId: targetClinicianId,
        targetFacility: referral_facility,
        referralType: 'GOVERNMENT_HEALTH_FACILITY_NHM',
        workerNote: worker_note
      }
    });

    await conn.commit();

    res.status(201).json({
      success: true,
      escalationId,
      flagId: flag_id,
      status: 'pending',
      referralFacility: referral_facility
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Escalation Submit Error]', error);
    res.status(500).json({ error: 'Failed to escalate clinical alert' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/escalations/queue
 * Clinician triage queue: lists pending or reviewed escalated cases with full clinical context.
 */
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const statusFilter = req.query.status || 'all'; // pending | reviewed | all

    let statusClause = '';
    const params = [];

    if (statusFilter !== 'all') {
      statusClause = 'AND e.status = ?';
      params.push(statusFilter);
    }

    const [rows] = await pool.query(
      `SELECT 
        e.id AS escalation_id,
        e.status AS escalation_status,
        e.clinician_note,
        e.outcome,
        e.created_at AS escalated_at,
        e.updated_at AS last_reviewed_at,
        f.id AS flag_id,
        f.rule_id,
        f.severity AS flag_severity,
        f.triggering_values,
        p.id AS patient_id,
        p.pseudonym,
        p.age_band,
        p.village_or_ward,
        p.cohort,
        p.abha_id,
        c.id AS check_in_id,
        c.symptoms,
        c.measurements,
        c.notes AS check_in_notes,
        u_worker.full_name AS escalated_by_worker,
        u_doc.full_name AS assigned_clinician
       FROM escalations e
       JOIN flags f ON e.flag_id = f.id
       JOIN patients p ON f.patient_id = p.id
       LEFT JOIN check_ins c ON f.check_in_id = c.id
       LEFT JOIN users u_worker ON e.from_worker_id = u_worker.id
       LEFT JOIN users u_doc ON e.to_clinician_id = u_doc.id
       WHERE 1=1 ${statusClause}
       ORDER BY e.created_at DESC`,
      params
    );

    res.json({
      count: rows.length,
      queue: rows.map(r => ({
        ...r,
        triggering_values: typeof r.triggering_values === 'string' ? JSON.parse(r.triggering_values) : r.triggering_values,
        symptoms: typeof r.symptoms === 'string' ? JSON.parse(r.symptoms) : (r.symptoms || []),
        measurements: typeof r.measurements === 'string' ? JSON.parse(r.measurements) : (r.measurements || {})
      }))
    });
  } catch (error) {
    console.error('[Escalation Queue Error]', error);
    res.status(500).json({ error: 'Failed to retrieve clinician escalation queue' });
  }
});

/**
 * PATCH /api/escalations/:id/review
 * Clinician records review notes and clinical advice/outcome.
 * Can mark status as 'reviewed', 'action_taken', or 'closed'.
 */
router.patch('/:id/review', authenticateToken, requireRole(['clinician', 'supervisor']), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { id } = req.params;
    const { clinician_note, outcome = 'Advised In-Clinic Follow-up', status = 'reviewed' } = req.body;

    if (!clinician_note) {
      return res.status(400).json({ error: 'Clinician note is required when reviewing an escalation' });
    }

    if (!['reviewed', 'action_taken', 'closed'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: 'reviewed', 'action_taken', 'closed'" });
    }

    await conn.beginTransaction();

    const [escRows] = await conn.query('SELECT * FROM escalations WHERE id = ? FOR UPDATE', [id]);
    if (escRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Escalation record not found' });
    }

    const escalation = escRows[0];

    await conn.query(
      `UPDATE escalations 
       SET clinician_note = ?, outcome = ?, status = ?, to_clinician_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [clinician_note, outcome, status, req.user.id, id]
    );

    // If marked closed, also resolve the underlying flag
    if (status === 'closed') {
      await conn.query("UPDATE flags SET status = 'resolved' WHERE id = ?", [escalation.flag_id]);
    }

    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: 'ESCALATION_REVIEWED',
      entityType: 'escalation',
      entityId: id,
      metadata: {
        flagId: escalation.flag_id,
        outcome,
        status,
        clinicianNote: clinician_note
      }
    });

    await conn.commit();

    res.json({
      success: true,
      escalationId: id,
      status,
      outcome,
      clinicianNote: clinician_note
    });
  } catch (error) {
    await conn.rollback();
    console.error('[Escalation Review Error]', error);
    res.status(500).json({ error: 'Failed to record clinician review' });
  } finally {
    conn.release();
  }
});

export default router;

