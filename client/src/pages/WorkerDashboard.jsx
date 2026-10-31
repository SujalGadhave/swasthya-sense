import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import FlagCard from '../components/FlagCard.jsx';
import CheckInForm from './CheckInForm.jsx';
import SimulatedMessageModal from '../components/SimulatedMessageModal.jsx';

export default function WorkerDashboard() {
  const { lang, t } = useLanguage();
  const [callList, setCallList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPatientForCheckIn, setSelectedPatientForCheckIn] = useState(null);
  const [selectedPatientForMessage, setSelectedPatientForMessage] = useState(null);
  const [escalatingFlag, setEscalatingFlag] = useState(null);
  const [escalateNote, setEscalateNote] = useState('');
  const [submittingEscalation, setSubmittingEscalation] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchCallList = async (currentFilter) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.patients.getCallList(currentFilter);
      setCallList(res.patients || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch call list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallList(filter);
  }, [filter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 6000);
  };

  const handleCheckInSuccess = (result) => {
    setSelectedPatientForCheckIn(null);
    const flagCount = result.flags ? result.flags.length : 0;
    showToast(
      `Check-in recorded successfully! ${flagCount} flag(s) generated. Next follow-up scheduled for ${result.nextDueDate}.`
    );
    fetchCallList(filter);
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    if (!escalatingFlag) return;
    setSubmittingEscalation(true);

    try {
      await api.escalations.create({
        flag_id: escalatingFlag.id,
        worker_note: escalateNote,
      });
      showToast(`Clinical alert [Rule ${escalatingFlag.rule_id}] escalated to clinician for review.`);
      setEscalatingFlag(null);
      setEscalateNote('');
      fetchCallList(filter);
    } catch (err) {
      alert(`Escalation failed: ${err.message}`);
    } finally {
      setSubmittingEscalation(false);
    }
  };

  const handleAcknowledgeReminder = async (flagId) => {
    try {
      await api.flags.updateStatus(flagId, 'acknowledged');
      showToast('Reminder marked as acknowledged.');
      fetchCallList(filter);
    } catch (err) {
      alert(err.message);
    }
  };

  // Metrics computation
  const metrics = {
    total: callList.length,
    concerning: callList.filter((p) => p.priorityRank === 1).length,
    overdue: callList.filter((p) => p.priorityRank === 2 || p.priorityRank === 3).length,
    dueSoon: callList.filter((p) => p.priorityRank === 4).length,
  };

  const getPriorityLabel = (rank, defaultLabel) => {
    if (lang === 'hi') {
      if (rank === 1) return t('priority_clinical');
      if (rank === 2) return t('priority_r3');
      if (rank === 3) return t('priority_r2');
      if (rank === 4) return t('priority_r1');
      return t('priority_routine');
    }
    return defaultLabel;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>{t('worker_dash_title')}</h2>
          <p className="page-subtitle">{t('worker_dash_subtitle')}</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => fetchCallList(filter)}
          disabled={loading}
        >
          {t('refresh_list')}
        </button>
      </div>

      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric-card metric-total">
          <span className="metric-num">{metrics.total}</span>
          <span className="metric-label">{t('metric_assigned')}</span>
        </div>
        <div className="metric-card metric-urgent">
          <span className="metric-num">{metrics.concerning}</span>
          <span className="metric-label">{t('metric_clinical_alerts')}</span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-num">{metrics.overdue}</span>
          <span className="metric-label">{t('metric_overdue')}</span>
        </div>
        <div className="metric-card metric-info">
          <span className="metric-num">{metrics.dueSoon}</span>
          <span className="metric-label">{t('metric_due_soon')}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-bar">
        <span className="filter-title">{t('filter_label')}</span>
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('filter_all')} ({metrics.total})
        </button>
        <button
          className={`filter-chip chip-concerning ${filter === 'concerning' ? 'active' : ''}`}
          onClick={() => setFilter('concerning')}
        >
          {t('filter_concerning')} ({metrics.concerning})
        </button>
        <button
          className={`filter-chip chip-overdue ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          {t('filter_overdue')} ({metrics.overdue})
        </button>
        <button
          className={`filter-chip chip-escalated ${filter === 'escalated' ? 'active' : ''}`}
          onClick={() => setFilter('escalated')}
        >
          {t('filter_escalated')}
        </button>
      </div>

      {/* Prioritized Patient Call List */}
      {loading ? (
        <div className="loading-state">Loading prioritized morning call list...</div>
      ) : callList.length === 0 ? (
        <div className="empty-state">
          <h3>No patients matching current filter</h3>
          <p>All follow-ups for this category are up to date.</p>
        </div>
      ) : (
        <div className="call-list-grid">
          {callList.map((patient) => {
            const hasClinical = patient.priorityRank === 1;
            const hasOverdue = patient.priorityRank === 2 || patient.priorityRank === 3;

            return (
              <div
                key={patient.patient_id}
                className={`patient-call-card ${hasClinical ? 'card-clinical-alert' : ''} ${hasOverdue ? 'card-overdue' : ''}`}
              >
                <div className="call-card-top">
                  <div className="patient-main-info">
                    <div className="patient-header-line">
                      <span className="patient-id-tag">{patient.pseudonym}</span>
                      <span className={`priority-pill priority-rank-${patient.priorityRank}`}>
                        {getPriorityLabel(patient.priorityRank, patient.priorityLabel)}
                      </span>
                    </div>

                    <div className="patient-meta-tags">
                      <span className="meta-tag tag-cohort">{patient.cohort?.toUpperCase()}</span>
                      <span className="meta-tag tag-location">📍 {patient.village_or_ward}</span>
                      <span className="meta-tag tag-age">👤 {patient.age_band}</span>
                      <span className={`consent-badge consent-${patient.consent_status}`}>
                        {patient.consent_status === 'consented' ? t('consent_yes') : t('consent_no')}
                      </span>
                    </div>
                  </div>

                  <div className="patient-schedule-info">
                    {patient.due_date ? (
                      <div>
                        <span className="due-date-label">{t('due_date_label')}</span>
                        <strong>{patient.due_date}</strong>
                        {patient.days_overdue > 0 ? (
                          <span className="overdue-tag">
                            {patient.days_overdue} {t('days_overdue')}
                          </span>
                        ) : (
                          <span className="due-soon-tag">
                            {t('in_days')} {Math.abs(patient.days_overdue)} {t('day_s')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">No scheduled check-in</span>
                    )}
                  </div>
                </div>

                {/* Flags list */}
                {patient.flags && patient.flags.length > 0 && (
                  <div className="card-flags-section">
                    <span className="flags-header">{t('flags_triggered_title')}</span>
                    <div className="flags-stack">
                      {patient.flags.map((flag) => (
                        <FlagCard
                          key={flag.id}
                          flag={flag}
                          isWorker={true}
                          onEscalate={(f) => setEscalatingFlag(f)}
                          onAcknowledge={handleAcknowledgeReminder}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Escalation status banner if active */}
                {patient.escalation_status && (
                  <div className="escalation-status-banner">
                    ↗ {t('escalation_status_label')} <strong>{patient.escalation_status.toUpperCase()}</strong>
                  </div>
                )}

                {/* Card footer actions */}
                <div className="call-card-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedPatientForCheckIn(patient)}
                  >
                    {t('record_checkin_btn')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-msg-preview"
                    onClick={() => setSelectedPatientForMessage(patient)}
                    title="Preview patient SMS / WhatsApp follow-up reminder"
                  >
                    💬 {lang === 'hi' ? 'व्हाट्सएप प्रीव्यू' : 'WhatsApp Preview'}
                  </button>

                  <Link to={`/patient/${patient.patient_id}`} className="btn btn-outline">
                    {t('view_timeline_btn')}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Check-In Modal */}
      {selectedPatientForCheckIn && (
        <CheckInForm
          patient={selectedPatientForCheckIn}
          existingCheckInId={selectedPatientForCheckIn.check_in_id}
          onClose={() => setSelectedPatientForCheckIn(null)}
          onSuccess={handleCheckInSuccess}
        />
      )}

      {/* Escalation Modal */}
      {escalatingFlag && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Escalate Clinical Alert to Clinician</h3>
                <span className="modal-subtitle">
                  Flag: [Rule {escalatingFlag.rule_id}] {escalatingFlag.explanation}
                </span>
              </div>
              <button className="btn-close" onClick={() => setEscalatingFlag(null)}>✕</button>
            </div>

            <form onSubmit={handleEscalateSubmit} className="escalate-modal-form">
              <div className="form-group">
                <label>Target Medical Officer</label>
                <input
                  type="text"
                  value="Dr. Rajesh Sharma (Medical Officer - PHC)"
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Frontline Worker Observations & Reason for Escalation</label>
                <textarea
                  rows="4"
                  placeholder="Describe patient symptoms, reported distress, or reasons requiring medical clinician review..."
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  required
                />
              </div>

              <div className="prototype-notice-box">
                ℹ️ <em>Submitting will route this case directly into the clinician review queue. The system does not diagnose; medical evaluation is conducted by the clinician.</em>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEscalatingFlag(null)}
                  disabled={submittingEscalation}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-escalate"
                  disabled={submittingEscalation}
                >
                  {submittingEscalation ? 'Sending Escalation...' : 'Confirm & Escalate to Clinician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulated Patient Message Preview Modal */}
      {selectedPatientForMessage && (
        <SimulatedMessageModal
          patient={selectedPatientForMessage}
          onClose={() => setSelectedPatientForMessage(null)}
        />
      )}
    </div>
  );
}

