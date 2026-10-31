import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { initDb } from '../src/db/db.js';

describe('Swasthya Sense — Domain REST APIs & Workflows', () => {
  let workerToken;
  let clinicianToken;
  let supervisorToken;

  beforeAll(async () => {
    await initDb();

    // Authenticate worker
    const wRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'worker1', password: 'Worker@123' });
    workerToken = wRes.body.token;

    // Authenticate clinician
    const cRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dr_sharma', password: 'Doctor@123' });
    clinicianToken = cRes.body.token;

    // Authenticate supervisor
    const sRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin_anita', password: 'Admin@123' });
    supervisorToken = sRes.body.token;
  });

  it('1. GET /api/patients/call-list returns prioritized call list', async () => {
    const res = await request(app)
      .get('/api/patients/call-list')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patients).toBeDefined();
    expect(res.body.patients.length).toBeGreaterThan(0);

    // Verify ordering: highest priority first
    const ranks = res.body.patients.map(p => p.priorityRank);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }

    // Top patient should have Clinical Alert
    expect(res.body.patients[0].priorityRank).toBe(1);
    expect(res.body.patients[0].priorityLabel).toBe('Clinical Alert');
  });

  it('2. POST /api/checkins records check-in and auto-evaluates clinical flags', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        patient_id: 'pat-anc-02',
        channel: 'in_person',
        symptoms: ['severe_headache_visual_changes'],
        measurements: {
          systolic: 148,
          diastolic: 94,
          weightKg: 55
        },
        notes: 'Patient arrived with persistent headache and elevated BP'
      });

    expect(res.status).toBe(201);
    expect(res.body.checkInId).toBeDefined();
    expect(res.body.flags).toBeDefined();
    expect(res.body.nextDueDate).toBeDefined();

    const ruleIds = res.body.flags.map(f => f.rule_id);
    expect(ruleIds).toContain('R4'); // Elevated BP threshold
    expect(ruleIds).toContain('R6'); // Danger sign in antenatal cohort

    const r4Flag = res.body.flags.find(f => f.rule_id === 'R4');
    expect(r4Flag.explanation.toLowerCase()).toContain('flagged for clinician review');
  });

  it('3. POST /api/escalations creates an escalation to clinician', async () => {
    // Fetch newly created clinical flag
    const flagsRes = await request(app)
      .get('/api/flags?type=clinical&status=active')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(flagsRes.body.flags.length).toBeGreaterThan(0);
    const targetFlag = flagsRes.body.flags[0];

    const escRes = await request(app)
      .post('/api/escalations')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        flag_id: targetFlag.id,
        worker_note: 'Patient needs prompt medical evaluation'
      });

    expect(escRes.status).toBe(201);
    expect(escRes.body.escalationId).toBeDefined();
    expect(escRes.body.status).toBe('pending');
  });

  it('4. GET /api/escalations/queue allows clinician to view pending escalations', async () => {
    const res = await request(app)
      .get('/api/escalations/queue?status=pending')
      .set('Authorization', `Bearer ${clinicianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.queue).toBeDefined();
    expect(res.body.queue.length).toBeGreaterThan(0);
    expect(res.body.queue[0].pseudonym).toBeDefined();
    expect(res.body.queue[0].triggering_values).toBeDefined();
  });

  it('5. PATCH /api/escalations/:id/review allows clinician to review and close case', async () => {
    const queueRes = await request(app)
      .get('/api/escalations/queue?status=pending')
      .set('Authorization', `Bearer ${clinicianToken}`);

    const targetEsc = queueRes.body.queue[0];

    const reviewRes = await request(app)
      .patch(`/api/escalations/${targetEsc.escalation_id}/review`)
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        clinician_note: 'Reviewed vitals. Prescribed urgent in-person PHC referral and observation.',
        outcome: 'Urgent PHC Referral',
        status: 'closed'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe('closed');
  });

  it('6. PATCH /api/patients/:id/consent toggles consent status', async () => {
    const res = await request(app)
      .patch('/api/patients/pat-anc-05/consent')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ consent_status: 'declined' });

    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('declined');

    // Toggle back to consented
    const resRestore = await request(app)
      .patch('/api/patients/pat-anc-05/consent')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ consent_status: 'consented' });

    expect(resRestore.status).toBe(200);
    expect(resRestore.body.newStatus).toBe('consented');
  });

  it('7. PUT /api/schedules enforces role barrier (worker 403, supervisor 200)', async () => {
    // Worker attempt -> 403 Forbidden
    const workerAttempt = await request(app)
      .put('/api/schedules/hypertension')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        interval_days: 28,
        grace_period_days: 4,
        reminder_lead_time_days: 2
      });

    expect(workerAttempt.status).toBe(403);

    // Supervisor attempt -> 200 OK
    const supervisorAttempt = await request(app)
      .put('/api/schedules/hypertension')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        interval_days: 28,
        grace_period_days: 4,
        reminder_lead_time_days: 2
      });

    expect(supervisorAttempt.status).toBe(200);
    expect(supervisorAttempt.body.interval_days).toBe(28);
    expect(supervisorAttempt.body.version).toBeGreaterThanOrEqual(2);
  });

  it('8. GET /api/audit enforces role barrier (worker 403, supervisor 200)', async () => {
    // Worker attempt -> 403 Forbidden
    const workerRes = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(workerRes.status).toBe(403);

    // Supervisor attempt -> 200 OK
    const supRes = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(supRes.status).toBe(200);
    expect(supRes.body.records).toBeDefined();
    expect(supRes.body.records.length).toBeGreaterThan(0);
  });

  it('9. GET /api/messages returns simulated SMS/WhatsApp log with consent suppression', async () => {
    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
    expect(res.body.messages.length).toBeGreaterThan(0);

    const statuses = res.body.messages.map(m => m.status);
    expect(statuses).toContain('simulated_sent');
    expect(statuses).toContain('failed_no_consent'); // Demonstrates privacy constraint
  });

  it('10. GET /api/patients/:id/fhir produces valid ABDM FHIR R4 Document Bundle', async () => {
    const res = await request(app)
      .get('/api/patients/pat-htn-01/fhir')
      .set('Authorization', `Bearer ${clinicianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    expect(res.body.type).toBe('collection');
    expect(res.body.entry).toBeDefined();
    expect(res.body.entry.length).toBeGreaterThan(0);

    const patientRes = res.body.entry.find(e => e.resource.resourceType === 'Patient');
    expect(patientRes).toBeDefined();
    expect(patientRes.resource.identifier).toBeDefined();
  });

  it('11. POST /api/checkins rejects duplicate submission idempotently using client_uuid', async () => {
    const testUuid = `idempotent-test-${Date.now()}`;
    const payload = {
      patient_id: 'pat-htn-02',
      client_uuid: testUuid,
      channel: 'in_person',
      measurements: { systolic: 130, diastolic: 85 },
      notes: 'Initial test entry'
    };

    // First attempt -> 201 Created
    const firstRes = await request(app)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${workerToken}`)
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.checkInId).toBeDefined();

    // Duplicate replay -> 200 OK with already_processed: true (Idempotency shield!)
    const secondRes = await request(app)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${workerToken}`)
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.already_processed).toBe(true);
    expect(secondRes.body.checkInId).toBe(firstRes.body.checkInId);
  });
});
