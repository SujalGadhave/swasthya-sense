import React, { useState, useEffect } from 'react';
import { api } from '../api/api.js';
import VitalTrendSparkline from '../components/VitalTrendSparkline.jsx';

export default function ClinicianQueue() {
  const [queue, setQueue] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingEscalation, setReviewingEscalation] = useState(null);
  const [clinicianNote, setClinicianNote] = useState('');
  const [outcome, setOutcome] = useState('Scheduled In-Clinic Visit');
  const [actionStatus, setActionStatus] = useState('reviewed');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchQueue = async (filter) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.escalations.getQueue(filter);
      setQueue(res.queue || []);
    } catch (err) {
      setError(err.message || 'Failed to load clinician triage queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const handleOpenReview = (esc) => {
    setReviewingEscalation(esc);
    setClinicianNote(esc.clinician_note || '');
    setOutcome(esc.outcome || 'Scheduled In-Clinic Visit');
    setActionStatus('reviewed');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewingEscalation) return;
    setSubmitting(true);

    try {
      await api.escalations.review(reviewingEscalation.escalation_id, {
        clinician_note: clinicianNote,
        outcome,
        status: actionStatus,
      });

      showToast(`Escalation updated with clinical action: '${outcome}' (Status: ${actionStatus}).`);
      setReviewingEscalation(null);
      fetchQueue(statusFilter);
    } catch (err) {
      alert(`Review submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = queue.filter((e) => e.escalation_status === 'pending').length;
  const reviewedCount = queue.filter((e) => e.escalation_status === 'reviewed').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Clinician Review & Escalation Queue</h2>
          <p className="page-subtitle">
            Medical Officer Review of High-Risk Flags Escalated by Frontline Workers
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchQueue(statusFilter)} disabled={loading}>
          🔄 Refresh Queue
        </button>
      </div>

      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric-card metric-urgent">
          <span className="metric-num">{pendingCount}</span>
          <span className="metric-label">Pending Medical Review</span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-num">{reviewedCount}</span>
          <span className="metric-label">Active / Reviewed Cases</span>
        </div>
        <div className="metric-card metric-total">
          <span className="metric-num">{queue.length}</span>
          <span className="metric-label">Total Escalations in Queue</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-bar">
        <span className="filter-title">Filter Queue:</span>
        <button
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Cases ({queue.length})
        </button>
        <button
          className={`filter-chip chip-concerning ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          ⏳ Awaiting Review ({pendingCount})
        </button>
        <button
          className={`filter-chip chip-escalated ${statusFilter === 'reviewed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('reviewed')}
        >
          ✓ Reviewed / In-Progress ({reviewedCount})
        </button>
      </div>

      {/* Escalation Queue Cards */}
      {loading ? (
        <div className="loading-state">Loading clinician queue...</div>
      ) : queue.length === 0 ? (
        <div className="empty-state">
          <h3>No escalated cases in this view</h3>
          <p>No active alerts currently require clinician review.</p>
        </div>
      ) : (
        <div className="escalation-queue-list">
          {queue.map((esc) => {
            const isPending = esc.escalation_status === 'pending';
            const trigVals = esc.triggering_values || {};
            const measurements = esc.measurements || {};
            const symptoms = esc.symptoms || [];

            return (
              <div
                key={esc.escalation_id}
                className={`queue-card ${isPending ? 'card-pending-review' : 'card-reviewed'}`}
              >
                <div className="queue-card-header">
                  <div>
                    <div className="queue-title-row">
                      <span className="patient-id-tag">{esc.pseudonym}</span>
                      <span className="meta-tag tag-cohort">{esc.cohort?.toUpperCase()}</span>
                      <span className="meta-tag tag-location">📍 {esc.village_or_ward}</span>
                      <span className="meta-tag tag-age">👤 {esc.age_band}</span>
                    </div>
                    <span className="escalation-byline">
                      Escalated by {esc.escalated_by_worker || 'Frontline Worker'} on {new Date(esc.escalated_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="queue-status-badge">
                    <span className={`status-pill status-${esc.escalation_status}`}>
                      {esc.escalation_status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Flag & Supporting Evidence */}
                <div className="queue-evidence-box">
                  <div className="evidence-header">
                    <strong>🚨 Clinical Flag Triggered: [Rule {esc.rule_id}]</strong>
                    <span className="severity-tag severity-urgent">Severity: {esc.flag_severity}</span>
                  </div>

                  {/* Triggering values breakdown / Visual trend */}
                  {Array.isArray(trigVals.systolicTrend) && trigVals.systolicTrend.length >= 2 ? (
                    <VitalTrendSparkline
                      readings={trigVals.systolicTrend}
                      threshold={140}
                      unit="mmHg"
                      label="Systolic BP"
                    />
                  ) : (
                    <div className="triggering-summary">
                      <span>Trigger inputs: </span>
                      {Object.entries(trigVals).map(([k, v]) => (
                        <span key={k} className="value-chip">
                          {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Check-in Vitals & Symptoms */}
                  <div className="vitals-context-grid">
                    {measurements.systolic && measurements.diastolic && (
                      <div className="vital-context-item">
                        <span className="vital-label">Blood Pressure</span>
                        <span className="vital-val">{measurements.systolic}/{measurements.diastolic} mmHg</span>
                      </div>
                    )}
                    {measurements.fastingGlucose && (
                      <div className="vital-context-item">
                        <span className="vital-label">Fasting Glucose</span>
                        <span className="vital-val">{measurements.fastingGlucose} mg/dL</span>
                      </div>
                    )}
                    {measurements.randomGlucose && (
                      <div className="vital-context-item">
                        <span className="vital-label">Random Glucose</span>
                        <span className="vital-val">{measurements.randomGlucose} mg/dL</span>
                      </div>
                    )}
                    {measurements.weightKg && (
                      <div className="vital-context-item">
                        <span className="vital-label">Weight</span>
                        <span className="vital-val">{measurements.weightKg} kg</span>
                      </div>
                    )}
                  </div>

                  {symptoms.length > 0 && (
                    <div className="symptoms-context">
                      <strong>Reported Danger Signs:</strong>
                      <span className="symptom-tag-list">
                        {symptoms.map((s) => (
                          <span key={s} className="symptom-tag">⚠️ {s.replace(/_/g, ' ')}</span>
                        ))}
                      </span>
                    </div>
                  )}

                  {esc.check_in_notes && (
                    <div className="worker-notes-quote">
                      <em>Worker observation:</em> "{esc.check_in_notes}"
                    </div>
                  )}
                </div>

                {/* Existing Review Notes if any */}
                {esc.clinician_note && (
                  <div className="clinician-notes-box">
                    <strong>Medical Officer Review Notes:</strong>
                    <p className="clinician-note-text">"{esc.clinician_note}"</p>
                    <div className="outcome-line">
                      <span>Clinical Action Taken:</span> <strong>{esc.outcome}</strong>
                    </div>
                  </div>
                )}

                {/* Action button */}
                <div className="queue-card-actions">
                  <button className="btn btn-primary" onClick={() => handleOpenReview(esc)}>
                    🩺 {isPending ? 'Review Case & Record Decision' : 'Update Clinical Notes'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clinician Review Modal */}
      {reviewingEscalation && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Clinician Medical Review</h3>
                <span className="modal-subtitle">
                  Patient: {reviewingEscalation.pseudonym} · Flag: [Rule {reviewingEscalation.rule_id}]
                </span>
              </div>
              <button className="btn-close" onClick={() => setReviewingEscalation(null)}>✕</button>
            </div>

            <form onSubmit={handleReviewSubmit} className="clinician-review-form">
              <div className="form-group">
                <label>Clinical Guidance & Review Notes (Required)</label>
                <textarea
                  rows="4"
                  placeholder="Record clinical assessment, medication review notes, or instructions for the health worker/patient..."
                  value={clinicianNote}
                  onChange={(e) => setClinicianNote(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Clinical Action / Recommended Outcome</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="Scheduled In-Clinic Visit">🏥 Scheduled In-Clinic PHC Visit</option>
                  <option value="Urgent PHC Referral">🚨 Urgent PHC / Hospital Referral</option>
                  <option value="Adjusted Medication & Home Care">💊 Adjusted Medication & Guided Home Care</option>
                  <option value="Resolved / Returned to Routine Follow-up">✓ Resolved / Returned to Routine Care</option>
                </select>
              </div>

              <div className="form-group">
                <label>Escalation Case Status</label>
                <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}>
                  <option value="reviewed">Keep Open as 'Reviewed' (Under active monitoring)</option>
                  <option value="action_taken">Mark 'Action Taken' (Referred / Scheduled)</option>
                  <option value="closed">Close Case (Alert fully addressed)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewingEscalation(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting Clinical Review...' : 'Save Clinical Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

