import React from 'react';

/**
 * FlagCard component
 * Renders transparent explainable risk flags with strict visual separation
 * between administrative reminders (grey) and clinical alerts (red).
 */
export default function FlagCard({ flag, onEscalate, onAcknowledge, isWorker = false }) {
  const isClinical = flag.type === 'clinical';
  const isUrgent = flag.severity === 'urgent';
  const values = typeof flag.triggering_values === 'string'
    ? JSON.parse(flag.triggering_values)
    : (flag.triggering_values || {});

  return (
    <div className={`flag-card ${isClinical ? 'flag-clinical' : 'flag-reminder'} ${isUrgent ? 'flag-urgent' : ''}`}>
      <div className="flag-header">
        <div className="flag-tags">
          <span className={`flag-badge ${isClinical ? 'badge-clinical' : 'badge-reminder'}`}>
            {isClinical ? '🚨 Clinical Alert' : '📅 Administrative Reminder'}
          </span>
          <span className="flag-rule-id">Rule {flag.rule_id}</span>
          <span className={`severity-tag severity-${flag.severity || 'info'}`}>
            {flag.severity}
          </span>
          {flag.status && (
            <span className={`status-tag status-${flag.status}`}>
              {flag.status}
            </span>
          )}
        </div>
      </div>

      <div className="flag-body">
        <p className="flag-explanation">
          {flag.explanation || flag.description || 'Flagged for clinician review based on protocol threshold.'}
        </p>

        {/* Triggering values breakdown */}
        {Object.keys(values).length > 0 && (
          <div className="triggering-values">
            <span className="values-label">Triggering inputs:</span>
            <div className="values-chips">
              {Object.entries(values).map(([k, v]) => (
                <span key={k} className="value-chip">
                  <strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flag-disclaimer">
          ⚠️ <em>Prototype — Flagged for clinician review. Thresholds illustrative only.</em>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flag-actions">
        {isClinical && flag.status === 'active' && onEscalate && (
          <button
            type="button"
            className="btn btn-escalate"
            onClick={() => onEscalate(flag)}
          >
            ↗ Escalate to Clinician
          </button>
        )}

        {!isClinical && flag.status === 'active' && onAcknowledge && (
          <button
            type="button"
            className="btn btn-acknowledge"
            onClick={() => onAcknowledge(flag.id)}
          >
            ✓ Mark Acknowledged
          </button>
        )}
      </div>
    </div>
  );
}

