import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { initDb } from '../src/db/db.js';

describe('Swasthya Sense — Authentication API', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/auth/demo-users returns available personas', async () => {
    const res = await request(app).get('/api/auth/demo-users');
    expect(res.status).toBe(200);
    expect(res.body.demoUsers).toBeDefined();
    expect(res.body.demoUsers.length).toBe(3);
    const roles = res.body.demoUsers.map(u => u.role);
    expect(roles).toContain('worker');
    expect(roles).toContain('clinician');
    expect(roles).toContain('supervisor');
  });

  it('POST /api/auth/login succeeds with valid worker credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'worker1', password: 'Worker@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('worker');
    expect(res.body.user.full_name).toContain('Sunita Devi');
  });

  it('POST /api/auth/login rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'worker1', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid username or password');
  });

  it('GET /api/auth/me returns 401 without Bearer token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns profile with valid Bearer token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dr_sharma', password: 'Doctor@123' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe('dr_sharma');
    expect(meRes.body.user.role).toBe('clinician');
  });
});

