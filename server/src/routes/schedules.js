import express from 'express';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { logAudit } from '../middleware/logAudit.js';

const router = express.Router();

/**
 * GET /api/schedules
 * Returns follow-up schedule configurations for all cohorts.
 */
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM schedules ORDER BY cohort ASC');
    res.json({ schedules: rows });
  } catch (error) {
    console.error('[Schedules Query Error]', error);
    res.status(500).json({ error: 'Failed to retrieve follow-up schedules' });
  }
});

/**
 * PUT /api/schedules/:cohort
 * Updates follow-up schedule parameters. Restricted to Supervisors.
 * Increments schedule version and records in audit_log.
 */
router.put('/:cohort', authenticateToken, requireRole(['supervisor']), async (req, res) => {
  const pool = getPool();
  const { cohort } = req.params;
  const { interval_days, grace_period_days, reminder_lead_time_days } = req.body;

  if (!interval_days || !grace_period_days || !reminder_lead_time_days) {
    return res.status(400).json({
      error: 'interval_days, grace_period_days, and reminder_lead_time_days are required'
    });
  }

  const conn = await pool.getConnection();
  let inTransaction = false;

  try {
    await conn.beginTransaction();
    inTransaction = true;

    const [existingRows] = await conn.query('SELECT * FROM schedules WHERE cohort = ? FOR UPDATE', [cohort]);
    if (existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: `Schedule for cohort '${cohort}' not found` });
    }

    const current = existingRows[0];
    const newVersion = (current.version || 1) + 1;

    await conn.query(
      `UPDATE schedules 
       SET interval_days = ?, grace_period_days = ?, reminder_lead_time_days = ?, version = ?, updated_at = NOW()
       WHERE cohort = ?`,
      [Number(interval_days), Number(grace_period_days), Number(reminder_lead_time_days), newVersion, cohort]
    );

    await logAudit(conn, {
      userId: req.user.id,
      role: req.user.role,
      action: 'SCHEDULE_CONFIG_UPDATED',
      entityType: 'schedule',
      entityId: cohort,
      metadata: {
        previous: {
          interval: current.interval_days,
          grace: current.grace_period_days,
          lead: current.reminder_lead_time_days,
          version: current.version
        },
        updated: {
          interval: Number(interval_days),
          grace: Number(grace_period_days),
          lead: Number(reminder_lead_time_days),
          version: newVersion
        }
      }
    });

    await conn.commit();
    inTransaction = false;

    res.json({
      success: true,
      cohort,
      version: newVersion,
      interval_days: Number(interval_days),
      grace_period_days: Number(grace_period_days),
      reminder_lead_time_days: Number(reminder_lead_time_days)
    });
  } catch (error) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('[Schedule Update Error]', error);
    res.status(500).json({ error: 'Failed to update schedule configuration' });
  } finally {
    conn.release();
  }
});

export default router;

