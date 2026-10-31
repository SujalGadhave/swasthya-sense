import crypto from 'crypto';

/**
 * Shared audit logging helper.
 * Must be executed within the same transaction connection as the state-changing operation,
 * or with a pool for non-transactional audit records.
 *
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} conn - Active DB connection or pool
 * @param {Object} entry
 * @param {string|null} entry.userId - Performing user ID
 * @param {string} entry.role - Performing user role ('worker', 'clinician', 'supervisor', 'system')
 * @param {string} entry.action - Action identifier (e.g. 'LOGIN', 'CHECKIN_RECORDED', 'FLAG_ESCALATED')
 * @param {string} entry.entityType - Type of target entity ('user', 'patient', 'check_in', 'flag', 'escalation', 'schedule', 'consent')
 * @param {string} entry.entityId - Primary identifier of target entity
 * @param {Object|null} [entry.metadata] - Optional arbitrary contextual JSON payload
 */
export async function logAudit(conn, {
  userId = null,
  role = 'system',
  action,
  entityType,
  entityId,
  metadata = null
}) {
  const id = crypto.randomUUID();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  await conn.query(
    `INSERT INTO audit_log (id, user_id, role, action, entity_type, entity_id, metadata, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, userId, role, action, entityType, String(entityId), metadataJson]
  );

  return id;
}
