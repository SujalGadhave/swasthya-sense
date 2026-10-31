import React from 'react';
import VitalTrendSparkline from './VitalTrendSparkline.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

/**
 * FlagCard component
 * Renders transparent explainable risk flags with strict visual separation
 * between administrative reminders (grey) and clinical alerts (red),
 * with inline SVG sparkline visualization for trend rules (R5).
 */
export default function FlagCard({ flag, onEscalate, onAcknowledge, isWorker = false }) {
  const { lang, t } = useLanguage();
  const isClinical = flag.type === 'clinical';
  const isUrgent = flag.severity === 'urgent';
  const values = typeof flag.triggering_values === 'string'
    ? JSON.parse(flag.triggering_values)
    : (flag.triggering_values || {});

  const hasTrendData = Array.isArray(values.systolicTrend) && values.systolicTrend.length >= 2;

  return (
    <div className={`flag-card ${isClinical ? 'flag-clinical' : 'flag-reminder'} ${isUrgent ? 'flag-urgent' : ''}`}>
      <div className="flag-header">
        <div className="flag-tags">
          <span className={`flag-badge ${isClinical ? 'badge-clinical' : 'badge-reminder'}`}>
            {isClinical
              ? (lang === 'hi' ? '🚨 चिकित्सा अलर्ट' : '🚨 Clinical Alert')
              : (lang === 'hi' ? '📅 प्रशासनिक अनुस्मारक' : '📅 Administrative Reminder')}
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

        {/* Visual Trendline Sparkline for Rising Trend Rule R5 */}
        {hasTrendData && (
          <VitalTrendSparkline
            readings={values.systolicTrend}
            threshold={140}
            unit="mmHg"
            label="Systolic BP"
          />
        )}

        {/* Triggering values breakdown */}
        {Object.keys(values).length > 0 && !hasTrendData && (
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
          {t('disclaimer_flag_text')}
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
            {t('escalate_btn')}
          </button>
        )}

        {!isClinical && flag.status === 'active' && onAcknowledge && (
          <button
            type="button"
            className="btn btn-acknowledge"
            onClick={() => onAcknowledge(flag.id)}
          >
            {t('acknowledge_btn')}
          </button>
        )}
      </div>
    </div>
  );
}
