import express from 'express';
import { getPool } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/messages
 * Returns simulated SMS/WhatsApp message log.
 * Demonstrates transparent reminder activity and non-consent suppression.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { status, channel } = req.query;

    let query = `
      SELECT 
        m.id,
        m.patient_id,
        m.channel,
        m.template_id,
        m.language,
        m.message_text,
        m.scheduled_at,
        m.status,
        m.created_at,
        p.pseudonym,
        p.cohort,
        p.consent_status
      FROM simulated_messages m
      JOIN patients p ON m.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }
    if (channel) {
      query += ' AND m.channel = ?';
      params.push(channel);
    }

    query += ' ORDER BY m.created_at DESC';

    const [rows] = await pool.query(query, params);

    res.json({
      count: rows.length,
      messages: rows
    });
  } catch (error) {
    console.error('[Messages Query Error]', error);
    res.status(500).json({ error: 'Failed to retrieve simulated messages log' });
  }
});

export default router;

