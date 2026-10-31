import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/db.js';
import { logAudit } from '../middleware/logAudit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * POST /api/auth/login
 * Authenticates user credentials, writes to audit log, and issues JWT.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role, full_name FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      await logAudit(pool, {
        userId: null,
        role: 'anonymous',
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: username,
        metadata: { reason: 'User not found' }
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      await logAudit(pool, {
        userId: user.id,
        role: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'Incorrect password' }
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    await logAudit(pool, {
      userId: user.id,
      role: user.role,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      metadata: { username: user.username, role: user.role }
    });

    return res.json({
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/demo-users
 * Returns available demo personas for easy hackathon demonstration.
 */
router.get('/demo-users', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, username, role, full_name FROM users ORDER BY role DESC'
    );
    res.json({ demoUsers: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch demo personas' });
  }
});

export default router;

