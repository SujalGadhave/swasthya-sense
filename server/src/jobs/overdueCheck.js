import cron from 'node-cron';
import crypto from 'crypto';
import { getPool } from '../db/db.js';
import { evaluateRules } from '../rules/evaluator.js';
import rulesConfig from '../rules/rules.json' with { type: 'json' };
import { logAudit } from '../middleware/logAudit.js';

/**
 * Runs the overdue and schedule evaluation check.
 * Callable manually for testing/API triggers or automatically via node-cron.
 *
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {Promise<Object>} Execution summary
 */
export async function runOverdueCheck(referenceDate = new Date()) {
  const pool = getPool();
  const ref = new Date(referenceDate);
  const refDateStr = ref.toISOString().split('T')[0];

  let flagsCreated = 0;
  let messagesCreated = 0;
  let messagesSuppressed = 0;

  console.log(`[Overdue Job] Running schedule check for reference date: ${refDateStr}`);

  // Fetch all pending check-ins with patient details and cohort schedule
  const [pendingCheckIns] = await pool.query(`
    SELECT 
      c.id AS check_in_id,
      c.patient_id,
      c.worker_id,
      c.due_date,
      c.completed_at,
      p.pseudonym,
      p.cohort,
      p.consent_status,
      s.interval_days,
      s.grace_period_days,
      s.reminder_lead_time_days
    FROM check_ins c
    JOIN patients p ON c.patient_id = p.id
    LEFT JOIN schedules s ON p.cohort = s.cohort
    WHERE c.completed_at IS NULL
  `);

  for (const row of pendingCheckIns) {
    const schedule = {
      interval_days: row.interval_days || 30,
      grace_period_days: row.grace_period_days || 3,
      reminder_lead_time_days: row.reminder_lead_time_days || 2
    };

    const patient = {
      id: row.patient_id,
      pseudonym: row.pseudonym,
      cohort: row.cohort,
      consent_status: row.consent_status
    };

    const checkIn = {
      id: row.check_in_id,
      due_date: typeof row.due_date === 'string'
        ? row.due_date
        : row.due_date.toISOString().split('T')[0],
      completed_at: null
    };

    const evaluatedFlags = evaluateRules({
      checkIn,
      patient,
      schedule,
      rulesConfig,
      referenceDate: ref
    });

    for (const flag of evaluatedFlags) {
      // Check if this flag is already active for this check-in
      const [existing] = await pool.query(
        'SELECT id FROM flags WHERE check_in_id = ? AND rule_id = ? AND status = "active"',
        [checkIn.id, flag.rule_id]
      );

      if (existing.length === 0) {
        const flagId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO flags (id, check_in_id, patient_id, type, rule_id, triggering_values, severity, status, rule_version, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
          [
            flagId,
            checkIn.id,
            patient.id,
            flag.type,
            flag.rule_id,
            JSON.stringify(flag.triggering_values),
            flag.severity,
            flag.rule_version
          ]
        );
        flagsCreated++;

        await logAudit(pool, {
          userId: null,
          role: 'system',
          action: 'FLAG_GENERATED',
          entityType: 'flag',
          entityId: flagId,
          metadata: { rule_id: flag.rule_id, patient_id: patient.id, type: flag.type }
        });

        // If it's a reminder flag (R1 or R2), trigger simulated messaging based on consent
        if (flag.type === 'reminder') {
          const messageId = crypto.randomUUID();
          const channel = 'sms';
          const templateId = flag.rule_id === 'R1' ? 'tpl_reminder_due_soon' : 'tpl_reminder_overdue';

          if (patient.consent_status === 'consented') {
            const messageText = flag.rule_id === 'R1'
              ? `Namaste. Routine health check-in is scheduled on ${checkIn.due_date}. Your ASHA worker will be in touch. (Swasthya Sense Simulated SMS)`
              : `Namaste. Your health follow-up was scheduled on ${checkIn.due_date} and is overdue. Please reach out to your local ASHA worker. (Swasthya Sense Simulated SMS)`;

            await pool.query(
              `INSERT INTO simulated_messages (id, patient_id, channel, template_id, language, message_text, scheduled_at, status, created_at)
               VALUES (?, ?, ?, ?, 'en', ?, NOW(), 'simulated_sent', NOW())`,
              [messageId, patient.id, channel, templateId, messageText]
            );
            messagesCreated++;

            await logAudit(pool, {
              userId: null,
              role: 'system',
              action: 'SIMULATED_MESSAGE_SENT',
              entityType: 'patient',
              entityId: patient.id,
              metadata: { messageId, templateId, channel }
            });
          } else {
            // Patient has declined consent: record suppressed message in table for transparency
            const messageText = `[SIMULATION SUPPRESSED] Reminder for due date ${checkIn.due_date} not sent: Patient has not consented to automated messaging.`;

            await pool.query(
              `INSERT INTO simulated_messages (id, patient_id, channel, template_id, language, message_text, scheduled_at, status, created_at)
               VALUES (?, ?, ?, ?, 'en', ?, NOW(), 'failed_no_consent', NOW())`,
              [messageId, patient.id, channel, templateId, messageText]
            );
            messagesSuppressed++;

            await logAudit(pool, {
              userId: null,
              role: 'system',
              action: 'SIMULATED_MESSAGE_SUPPRESSED_NO_CONSENT',
              entityType: 'patient',
              entityId: patient.id,
              metadata: { messageId, reason: 'consent_declined' }
            });
          }
        }
      }
    }
  }

  const summary = {
    pendingEvaluated: pendingCheckIns.length,
    flagsCreated,
    messagesCreated,
    messagesSuppressed
  };

  console.log(`[Overdue Job] Completed:`, summary);
  return summary;
}

/**
 * Initializes daily cron schedule (runs at 06:00 AM daily).
 */
export function startOverdueCronJob() {
  cron.schedule('0 6 * * *', async () => {
    try {
      await runOverdueCheck();
    } catch (err) {
      console.error('[Overdue Cron Error]', err);
    }
  });
  console.log('[Scheduler] Daily overdue check job scheduled for 06:00 AM.');
}

