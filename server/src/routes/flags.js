import express from 'express';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/logAudit.js';

const router = express.Router();

/**
 * GET /api/flags
 * Returns flags with optional filters (type, status, severity, patient_id).
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { type, status, severity, patient_id } = req.query;

    let query = `
      SELECT f.*, p.pseudonym, p.cohort, p.village_or_ward
      FROM flags f
      JOIN patients p ON f.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND f.type = ?';
      params.push(type);
    }
    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (severity) {
      query += ' AND f.severity = ?';
      params.push(severity);
    }
    if (patient_id) {
      query += ' AND f.patient_id = ?';
      params.push(patient_id);
    }

    query += ' ORDER BY f.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ flags: rows });
  } catch (error) {
    console.error('[Flags Query Error]', error);
    res.status(500).json({ error: 'Failed to retrieve flags' });
  }
});

/**
 * PATCH /api/flags/:id/status
 * Updates flag status (e.g. acknowledge a reminder).
 * Constraint: Frontline workers cannot unilaterally dismiss clinical alerts.
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  const { status } = req.body; // 'acknowledged', 'resolved'

  if (!['acknowledged', 'resolved', 'active'].includes(status)) {
    return res.status(400).json({ error: 'Invalid flag status' });
  }

  const conn = await pool.getConnection();
  let inTransaction = false;

  try {
    await conn.beginTransaction();
    inTransaction = true;

    const [flagRows] = await conn.query('SELECT * FROM flags WHERE id = ? FOR UPDATE', [id]);
    if (flagRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Flag not found' });
    }

    const flag = flagRows[0];

    // Blueprint constraint: Health worker cannot dismiss clinical alerts directly
    if (req.user.role === 'worker' && flag.type === 'clinical' && status === 'resolved') {
      await conn.rollback();
      return res.status(403).json({
        error: 'Clinical alerts cannot be dismissed directly by a health worker. Escalate to clinician for review.'
      });
    }

    await conn.query('UPDATE flags SET status = ? WHERE id = ?', [status, id]);

    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: 'FLAG_STATUS_UPDATED',
      entityType: 'flag',
      entityId: id,
      metadata: { previousStatus: flag.status, newStatus: status, ruleId: flag.rule_id }
    });

    await conn.commit();
    inTransaction = false;

    res.json({ success: true, flagId: id, status });
  } catch (error) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('[Flag Status Update Error]', error);
    res.status(500).json({ error: 'Failed to update flag status' });
  } finally {
    conn.release();
  }
});

export default router;

