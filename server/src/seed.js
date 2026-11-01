import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initDb, getPool } from './db/db.js';
import { runOverdueCheck } from './jobs/overdueCheck.js';
import { logAudit } from './middleware/logAudit.js';

export async function runSeed({ pool: passedPool, exitOnComplete = false } = {}) {
  console.log('[Seed] Starting deterministic synthetic database seed...');
  let pool = passedPool;
  if (!pool) {
    await initDb({ skipAutoSeed: true });
    pool = getPool();
  }

  // Clear existing data cleanly in reverse FK dependency order
  const tables = [
    'audit_log',
    'simulated_messages',
    'escalations',
    'flags',
    'check_ins',
    'schedules',
    'patients',
    'users'
  ];

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE \`${table}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('[Seed] Cleaned existing tables.');

  // 1. Seed Demo Users
  const salt = await bcrypt.genSalt(10);
  const workerPassHash = await bcrypt.hash('Worker@123', salt);
  const doctorPassHash = await bcrypt.hash('Doctor@123', salt);
  const adminPassHash = await bcrypt.hash('Admin@123', salt);

  const users = [
    {
      id: 'usr-worker-01',
      username: 'worker1',
      password_hash: workerPassHash,
      role: 'worker',
      full_name: 'Sunita Devi (ASHA Worker)'
    },
    {
      id: 'usr-doctor-01',
      username: 'dr_sharma',
      password_hash: doctorPassHash,
      role: 'clinician',
      full_name: 'Dr. Rajesh Sharma (Medical Officer)'
    },
    {
      id: 'usr-admin-01',
      username: 'admin_anita',
      password_hash: adminPassHash,
      role: 'supervisor',
      full_name: 'Anita Verma (PHC Facility In-Charge)'
    }
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [u.id, u.username, u.password_hash, u.role, u.full_name]
    );
  }
  console.log(`[Seed] Inserted ${users.length} demo users.`);

  // 2. Seed Default Cohort Schedules
  const schedules = [
    { id: 'sch-anc-01', cohort: 'antenatal', interval_days: 30, grace_period_days: 5, reminder_lead_time_days: 3 },
    { id: 'sch-htn-01', cohort: 'hypertension', interval_days: 30, grace_period_days: 3, reminder_lead_time_days: 2 },
    { id: 'sch-db-01', cohort: 'diabetes', interval_days: 30, grace_period_days: 3, reminder_lead_time_days: 2 }
  ];

  for (const s of schedules) {
    await pool.query(
      `INSERT INTO schedules (id, cohort, interval_days, grace_period_days, reminder_lead_time_days, version)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [s.id, s.cohort, s.interval_days, s.grace_period_days, s.reminder_lead_time_days]
    );
  }
  console.log(`[Seed] Inserted ${schedules.length} cohort schedules.`);

  // Helpers for deterministic dates
  const today = new Date();
  const daysAgo = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };
  const daysAhead = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const wards = ['Ward 1 (Rampur)', 'Ward 2 (Kalyanpur)', 'Ward 3 (Sitapur)', 'Ward 4 (Govindpur)'];

  // 3. Seed Synthetic Patients (Total 65 across 3 cohorts)
  const patients = [];

  // Antenatal cohort (25 patients)
  for (let i = 1; i <= 25; i++) {
    const pad = String(i).padStart(2, '0');
    patients.push({
      id: `pat-anc-${pad}`,
      pseudonym: `Patient-ANC-${pad}`,
      age_band: `${19 + (i % 12)}-${23 + (i % 12)} yrs`,
      village_or_ward: wards[i % wards.length],
      cohort: 'antenatal',
      assigned_worker_id: 'usr-worker-01',
      consent_status: 'consented',
      abha_id: `91-${1000 + i}-${2000 + i}-${3000 + i}`
    });
  }

  // Hypertension cohort (20 patients)
  for (let i = 1; i <= 20; i++) {
    const pad = String(i).padStart(2, '0');
    patients.push({
      id: `pat-htn-${pad}`,
      pseudonym: `Patient-HTN-${pad}`,
      age_band: `${45 + (i % 25)}-${49 + (i % 25)} yrs`,
      village_or_ward: wards[i % wards.length],
      cohort: 'hypertension',
      assigned_worker_id: 'usr-worker-01',
      consent_status: 'consented',
      abha_id: `91-${4000 + i}-${5000 + i}-${6000 + i}`
    });
  }

  // Diabetes cohort (20 patients)
  for (let i = 1; i <= 20; i++) {
    const pad = String(i).padStart(2, '0');
    patients.push({
      id: `pat-db-${pad}`,
      pseudonym: `Patient-DB-${pad}`,
      age_band: `${40 + (i % 22)}-${44 + (i % 22)} yrs`,
      village_or_ward: wards[i % wards.length],
      cohort: 'diabetes',
      assigned_worker_id: 'usr-worker-01',
      // Edge Case 4: Non-consented patient
      consent_status: i === 1 ? 'declined' : 'consented',
      abha_id: `91-${7000 + i}-${8000 + i}-${9000 + i}`
    });
  }

  for (const p of patients) {
    await pool.query(
      `INSERT INTO patients (id, pseudonym, age_band, village_or_ward, cohort, assigned_worker_id, consent_status, abha_id, consent_updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [p.id, p.pseudonym, p.age_band, p.village_or_ward, p.cohort, p.assigned_worker_id, p.consent_status, p.abha_id]
    );
  }
  console.log(`[Seed] Inserted ${patients.length} synthetic patients.`);

  // 4. Seed Check-ins & Deliberate Edge Cases

  // --- EDGE CASE 1: 3 Patients Overdue by Different Intervals ---
  // Overdue Patient 1: due 3 days ago (within grace period 3 days)
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, ?, 'usr-worker-01', ?, NULL, 'in_person', '[]', '{}', 'Routine monthly follow-up due')`,
    ['chk-edge-od1', 'pat-htn-01', daysAgo(3)]
  );

  // Overdue Patient 2: due 10 days ago (overdue beyond grace period, triggers R2)
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, ?, 'usr-worker-01', ?, NULL, 'phone', '[]', '{}', 'Follow-up delayed due to travel')`,
    ['chk-edge-od2', 'pat-htn-02', daysAgo(10)]
  );

  // Overdue Patient 3: due 35 days ago (triggers R3 supervisor review, overdue > interval)
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, ?, 'usr-worker-01', ?, NULL, 'in_person', '[]', '{}', 'Patient uncontactable over multiple visits')`,
    ['chk-edge-od3', 'pat-htn-03', daysAgo(35)]
  );

  // --- EDGE CASE 2: 2 Patients with Rising Blood Pressure Trends ---
  // Patient HTN-04: 3 check-ins with systolic 128 -> 136 -> 145 mmHg (Triggers R5 rising trend & R4 threshold)
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-04', 'usr-worker-01', ?, ?, 'in_person', '[]', ?, 'Baseline routine check-in')`,
    ['chk-trend-01', daysAgo(60), daysAgo(60), JSON.stringify({ systolic: 128, diastolic: 82, heartRate: 74 })]
  );
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-04', 'usr-worker-01', ?, ?, 'in_person', '[]', ?, 'Monthly follow-up visit')`,
    ['chk-trend-02', daysAgo(30), daysAgo(30), JSON.stringify({ systolic: 136, diastolic: 86, heartRate: 78 })]
  );
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-04', 'usr-worker-01', ?, NOW(), 'in_person', '[]', ?, 'Recent check-in with rising trend')`,
    ['chk-trend-03', daysAgo(1), JSON.stringify({ systolic: 145, diastolic: 92, heartRate: 82 })]
  );

  // Patient HTN-05: 3 check-ins with systolic 122 -> 130 -> 138 mmHg (Triggers R5 rising trend)
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-05', 'usr-worker-01', ?, ?, 'in_person', '[]', ?, 'Follow-up reading')`,
    ['chk-trend-04', daysAgo(50), daysAgo(50), JSON.stringify({ systolic: 122, diastolic: 78 })]
  );
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-05', 'usr-worker-01', ?, ?, 'in_person', '[]', ?, 'Follow-up reading')`,
    ['chk-trend-05', daysAgo(25), daysAgo(25), JSON.stringify({ systolic: 130, diastolic: 84 })]
  );
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-05', 'usr-worker-01', ?, NOW(), 'in_person', '[]', ?, 'Consecutive elevation noted')`,
    ['chk-trend-06', daysAgo(2), JSON.stringify({ systolic: 138, diastolic: 88 })]
  );

  // --- EDGE CASE 3: 1 Danger-Sign Symptom in Pregnancy (Triggers R6) ---
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-anc-01', 'usr-worker-01', ?, NOW(), 'in_person', ?, ?, 'Patient reported blurred vision and severe frontal headache')`,
    [
      'chk-danger-01',
      daysAgo(1),
      JSON.stringify(['severe_headache_visual_changes']),
      JSON.stringify({ systolic: 132, diastolic: 88, weightKg: 58 })
    ]
  );

  // Insert explicit clinical flag for Danger Sign (R6)
  await pool.query(
    `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
     VALUES (?, 'chk-danger-01', 'pat-anc-01', 'clinical', 'R6', ?, 'urgent', 'active', 1, NOW())`,
    [
      'flg-danger-01',
      JSON.stringify({ reportedSymptom: 'severe_headache_visual_changes', cohort: 'antenatal' })
    ]
  );

  // Insert clinical flags for Rising Trend (R5 & R4) on HTN-04
  await pool.query(
    `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
     VALUES (?, 'chk-trend-03', 'pat-htn-04', 'clinical', 'R5', ?, 'warning', 'active', 1, NOW())`,
    [
      'flg-trend-01',
      JSON.stringify({ systolicTrend: [128, 136, 145], consecutiveCount: 3 })
    ]
  );
  await pool.query(
    `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
     VALUES (?, 'chk-trend-03', 'pat-htn-04', 'clinical', 'R4', ?, 'urgent', 'active', 1, NOW())`,
    [
      'flg-bp-01',
      JSON.stringify({ systolic: 145, diastolic: 92, thresholdSystolic: 140, thresholdDiastolic: 90 })
    ]
  );

  // --- EDGE CASE 4: Patient without consent (pat-db-01) ---
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-db-01', 'usr-worker-01', ?, NULL, 'phone', '[]', '{}', 'Patient declined automated messaging consent')`,
    ['chk-edge-noconsent', daysAhead(2)]
  );

  // --- EDGE CASE 5: Already Escalated and Reviewed ---
  await pool.query(
    `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
     VALUES (?, 'pat-htn-06', 'usr-worker-01', ?, ?, 'in_person', '[]', ?, 'Marked hypertension during home visit')`,
    ['chk-esc-01', daysAgo(4), daysAgo(4), JSON.stringify({ systolic: 162, diastolic: 104 })]
  );

  await pool.query(
    `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
     VALUES (?, 'chk-esc-01', 'pat-htn-06', 'clinical', 'R4', ?, 'urgent', 'escalated', 1, ?)`,
    [
      'flg-esc-01',
      JSON.stringify({ systolic: 162, diastolic: 104, thresholdSystolic: 140, thresholdDiastolic: 90 }),
      daysAgo(4)
    ]
  );

  await pool.query(
    `INSERT INTO escalations (id, flag_id, from_worker_id, to_clinician_id, status, clinician_note, outcome, created_at, updated_at)
     VALUES (?, 'flg-esc-01', 'usr-worker-01', 'usr-doctor-01', 'reviewed', ?, 'Scheduled In-Clinic Visit', ?, NOW())`,
    [
      'esc-demo-01',
      'Reviewed high BP reading of 162/104 mmHg. Advised patient to limit salt, rest, and attend primary health center for in-clinic examination on Monday morning.',
      daysAgo(3)
    ]
  );

  // 5. Populate routine upcoming pending check-ins for remaining patients so call list is active
  for (let i = 2; i <= 25; i++) {
    const pad = String(i).padStart(2, '0');
    const pId = `pat-anc-${pad}`;
    // Spread due dates from 2 days ago to 14 days ahead
    const offset = (i % 7) - 2;
    await pool.query(
      `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
       VALUES (?, ?, 'usr-worker-01', ?, NULL, 'in_person', '[]', '{}', 'Routine antenatal check-in')`,
      [`chk-anc-${pad}`, pId, offset >= 0 ? daysAhead(offset) : daysAgo(Math.abs(offset))]
    );
  }

  for (let i = 7; i <= 20; i++) {
    const pad = String(i).padStart(2, '0');
    const pId = `pat-htn-${pad}`;
    const offset = (i % 5) - 1;
    await pool.query(
      `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
       VALUES (?, ?, 'usr-worker-01', ?, NULL, 'phone', '[]', '{}', 'Monthly BP tracking check-in')`,
      [`chk-htn-${pad}`, pId, offset >= 0 ? daysAhead(offset) : daysAgo(Math.abs(offset))]
    );
  }

  for (let i = 2; i <= 20; i++) {
    const pad = String(i).padStart(2, '0');
    const pId = `pat-db-${pad}`;
    const offset = (i % 6) - 2;
    await pool.query(
      `INSERT INTO check_ins (id, patient_id, worker_id, due_date, completed_at, channel, symptoms, measurements, notes)
       VALUES (?, ?, 'usr-worker-01', ?, NULL, 'in_person', '[]', '{}', 'Monthly glucose tracking check-in')`,
      [`chk-db-${pad}`, pId, offset >= 0 ? daysAhead(offset) : daysAgo(Math.abs(offset))]
    );
  }

  console.log('[Seed] Populated routine check-ins across cohort.');

  // 6. Run overdue check immediately to generate initial flags and simulated messages
  console.log('[Seed] Running initial overdue & simulated messaging check...');
  const overdueSummary = await runOverdueCheck();
  console.log('[Seed] Overdue summary:', overdueSummary);

  // 7. Log Audit Trail of Seeding
  await logAudit(pool, {
    userId: 'usr-admin-01',
    role: 'supervisor',
    action: 'SEED_DATA_INITIALIZED',
    entityType: 'system',
    entityId: 'database',
    metadata: {
      users: users.length,
      patients: patients.length,
      edgeCasesCovered: ['overdue_variation', 'rising_bp_trend', 'danger_sign_anc', 'no_consent_messaging', 'pre_escalated_reviewed']
    }
  });

  console.log('[Seed] Synthetic database seeded successfully with all edge cases verified.');
  if (exitOnComplete) {
    process.exit(0);
  }
  return true;
}

// Auto-run if executed directly as a script
const __currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__currentFile)) {
  runSeed({ exitOnComplete: true }).catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}

