import express from 'express';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';

const router = express.Router();

/**
 * GET /api/audit
 * Returns append-only audit trail records. Restricted to Supervisor role.
 */
router.get('/', authenticateToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const { action, entity_type, role } = req.query;

    let query = `
      SELECT 
        a.id,
        a.user_id,
        a.role,
        a.action,
        a.entity_type,
        a.entity_id,
        a.metadata,
        a.timestamp,
        u.full_name AS performed_by_name,
        u.username AS performed_by_username
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }
    if (entity_type) {
      query += ' AND a.entity_type = ?';
      params.push(entity_type);
    }
    if (role) {
      query += ' AND a.role = ?';
      params.push(role);
    }

    query += ' ORDER BY a.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM audit_log');

    res.json({
      total: countRows[0].total,
      limit,
      offset,
      records: rows.map(r => ({
        ...r,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
      }))
    });
  } catch (error) {
    console.error('[Audit Log Query Error]', error);
    res.status(500).json({ error: 'Failed to retrieve audit trail' });
  }
});

/**
 * GET /api/audit/summary
 * Returns overview statistics of audit activity for supervisor dashboard.
 */
router.get('/summary', authenticateToken, requireRole(['supervisor']), async (_req, res) => {
  try {
    const pool = getPool();
    const [actionCounts] = await pool.query(
      `SELECT action, COUNT(*) as count FROM audit_log GROUP BY action ORDER BY count DESC`
    );

    const [roleCounts] = await pool.query(
      `SELECT role, COUNT(*) as count FROM audit_log GROUP BY role ORDER BY count DESC`
    );

    res.json({
      byAction: actionCounts,
      byRole: roleCounts
    });
  } catch (error) {
    console.error('[Audit Summary Error]', error);
    res.status(500).json({ error: 'Failed to retrieve audit statistics' });
  }
});

export default router;

