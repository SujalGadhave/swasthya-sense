import React, { useState, useEffect } from 'react';
import { api } from '../api/api.js';
import VitalTrendSparkline from '../components/VitalTrendSparkline.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getPatientDisplayName, getLocalizedVillage } from '../utils/patientNames.js';
import { speakText, stopSpeech } from '../utils/speechHelper.js';

export default function ClinicianQueue() {
  const { lang, t } = useLanguage();
  const [queue, setQueue] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingEscalation, setReviewingEscalation] = useState(null);
  const [clinicianNote, setClinicianNote] = useState('');
  const [outcome, setOutcome] = useState('Scheduled In-Clinic Visit at Govt PHC');
  const [actionStatus, setActionStatus] = useState('reviewed');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [speakingEscId, setSpeakingEscId] = useState(null);
  const [selectedFhirModal, setSelectedFhirModal] = useState(null);

  const handleExportFhir = async (esc) => {
    setSelectedFhirModal({ patient: esc, bundle: null, loading: true, copied: false });
    try {
      const bundle = await api.patients.getFhir(esc.patient_id);
      setSelectedFhirModal({ patient: esc, bundle, loading: false, copied: false });
    } catch (err) {
      alert('Failed to load FHIR bundle: ' + err.message);
      setSelectedFhirModal(null);
    }
  };

  const handleCopyFhir = () => {
    if (!selectedFhirModal?.bundle) return;
    navigator.clipboard.writeText(JSON.stringify(selectedFhirModal.bundle, null, 2));
    setSelectedFhirModal(prev => ({ ...prev, copied: true }));
    setTimeout(() => {
      setSelectedFhirModal(prev => (prev ? { ...prev, copied: false } : null));
    }, 2500);
  };

  const handleDownloadFhir = () => {
    if (!selectedFhirModal?.bundle) return;
    const blob = new Blob([JSON.stringify(selectedFhirModal.bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FHIR-R4-${selectedFhirModal.patient?.pseudonym || 'patient'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const handleSpeakEscalation = (esc) => {
    if (speakingEscId === esc.escalation_id) {
      stopSpeech();
      setSpeakingEscId(null);
      return;
    }
    stopSpeech();
    const name = getPatientDisplayName(esc.pseudonym, lang);
    const vitals = esc.measurements?.systolic && esc.measurements?.diastolic
      ? `BP ${esc.measurements.systolic}/${esc.measurements.diastolic} mmHg.`
      : '';
    const script = lang === 'hi'
      ? `${name}, नियम ${esc.rule_id} के तहत रेफरल। ${vitals} कार्यकर्ता टिप्पणी: ${esc.check_in_notes || 'समीक्षा अपेक्षित'}`
      : `Patient ${name}, referred under Rule ${esc.rule_id}. ${vitals} Worker note: ${esc.check_in_notes || 'Review required'}`;

    setSpeakingEscId(esc.escalation_id);
    speakText(script, lang, () => setSpeakingEscId(null));
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
      {/* Unified Executive Doctor Dashboard Header */}
      <div className="dashboard-hero-header">
        <div className="hero-left">
          <div className="hero-avatar-wrap">
            <span className="hero-avatar-emblem">🩺</span>
          </div>
          <div className="hero-meta">
            <div className="hero-title-row">
              <h1 className="hero-title">{t('doctor_greeting')}</h1>
              <span className="hero-role-chip">{t('doctor_role_tag')}</span>
            </div>
            <p className="hero-subtitle">
              <span>📍 {t('doctor_location')}</span>
              <span className="hero-sep">•</span>
              <span>{t('doctor_sub')}</span>
            </p>
          </div>
        </div>

        <div className="hero-right">
          <button
            type="button"
            className="btn-refresh-clean"
            onClick={() => fetchQueue(statusFilter)}
            disabled={loading}
            title={lang === 'hi' ? 'कतार रीफ़्रेश करें' : 'Refresh queue'}
          >
            🔄
          </button>
        </div>
      </div>

      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Dynamic Clinical Triage KPI Cards */}
      <div className="triage-kpi-grid">
        <button
          type="button"
          className={`triage-kpi-card kpi-danger ${statusFilter === 'pending' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <div className="kpi-top">
            <span className="kpi-icon-wrap icon-danger">⏳</span>
            <span className="kpi-value">{pendingCount}</span>
          </div>
          <div className="kpi-body">
            <strong className="kpi-label">{t('doctor_awaiting')}</strong>
            <p className="kpi-subtext">
              {lang === 'hi' ? 'आशा कार्यकर्ताओं द्वारा भेजे गए गंभीर जोखिम मामले' : 'High-risk flags awaiting clinician decision'}
            </p>
          </div>
          <div className="kpi-footer">
            <span className="kpi-status-tag">
              {statusFilter === 'pending' ? (lang === 'hi' ? '✓ चयनित' : '✓ Filter Active') : (lang === 'hi' ? 'मामले देखें →' : 'View Cases →')}
            </span>
          </div>
        </button>

        <button
          type="button"
          className={`triage-kpi-card kpi-warning ${statusFilter === 'reviewed' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'reviewed' ? 'all' : 'reviewed')}
        >
          <div className="kpi-top">
            <span className="kpi-icon-wrap icon-warning">🩺</span>
            <span className="kpi-value">{reviewedCount}</span>
          </div>
          <div className="kpi-body">
            <strong className="kpi-label">{t('doctor_reviewed')}</strong>
            <p className="kpi-subtext">
              {lang === 'hi' ? 'जिन मामलों पर डॉक्टर द्वारा परामर्श दर्ज किया गया है' : 'Decisions logged and scheduled in clinic'}
            </p>
          </div>
          <div className="kpi-footer">
            <span className="kpi-status-tag">
              {statusFilter === 'reviewed' ? (lang === 'hi' ? '✓ चयनित' : '✓ Filter Active') : (lang === 'hi' ? 'समीक्षित देखें →' : 'View Reviewed →')}
            </span>
          </div>
        </button>

        <button
          type="button"
          className={`triage-kpi-card kpi-normal ${statusFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="kpi-top">
            <span className="kpi-icon-wrap icon-normal">📋</span>
            <span className="kpi-value">{queue.length}</span>
          </div>
          <div className="kpi-body">
            <strong className="kpi-label">{t('doctor_total')}</strong>
            <p className="kpi-subtext">
              {lang === 'hi' ? 'सभी प्राथमिक स्वास्थ्य केंद्र रेफरल रिकॉर्ड' : 'Total referrals logged across all cohorts'}
            </p>
          </div>
          <div className="kpi-footer">
            <span className="kpi-status-tag">
              {statusFilter === 'all' ? (lang === 'hi' ? '✓ सभी दिख रहे हैं' : '✓ Showing All') : (lang === 'hi' ? 'सभी देखें →' : 'View All →')}
            </span>
          </div>
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
                      <span className="patient-id-tag">
                        <strong>{getPatientDisplayName(esc.pseudonym, lang)}</strong> ({esc.pseudonym})
                      </span>
                      <button
                        type="button"
                        className={`btn-speech-read ${speakingEscId === esc.escalation_id ? 'is-speaking' : ''}`}
                        onClick={() => handleSpeakEscalation(esc)}
                        title={lang === 'hi' ? 'आवाज़ में सुनें' : 'Listen audio summary'}
                        aria-label="Listen audio summary"
                      >
                        {speakingEscId === esc.escalation_id ? '⏹️ बंद करें' : '🔊 सुनो'}
                      </button>
                      <span className="meta-tag tag-cohort">{esc.cohort?.toUpperCase()}</span>
                      <span className="meta-tag tag-location">📍 {getLocalizedVillage(esc.village_or_ward, lang)}</span>
                      <span className="meta-tag tag-age">👤 {esc.age_band}</span>
                      {esc.abha_id && (
                        <span className="meta-tag tag-abha" title="Ayushman Bharat Health Account ID">
                          🆔 ABHA: {esc.abha_id}
                        </span>
                      )}
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
                  <button
                    type="button"
                    className="btn btn-secondary btn-fhir-action"
                    onClick={() => handleExportFhir(esc)}
                    title="Export standard HL7 FHIR R4 Document Bundle for ABDM"
                  >
                    🌐 Export FHIR R4 (ABDM)
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
              {/* 1-Tap Standard NHM Protocol Presets for Rapid OPD Triage */}
              <div className="form-group">
                <label className="nhm-preset-label">
                  ⚡ <strong>1-Tap NHM Clinical Presets (Quick Decision):</strong>
                </label>
                <div className="quick-action-presets">
                  <button
                    type="button"
                    className="preset-btn preset-admit"
                    onClick={() => {
                      setClinicianNote('Admitted to PHC Sitapur observation ward for 24h vital monitoring. Free NHM labs (CBC, urine albumin) ordered.');
                      setOutcome('Scheduled In-Clinic Visit at Govt PHC');
                      setActionStatus('action_taken');
                    }}
                  >
                    🏥 Admit to PHC High-Risk Ward
                  </button>
                  <button
                    type="button"
                    className="preset-btn preset-ambulance"
                    onClick={() => {
                      setClinicianNote('Urgent 108 Ambulance transfer to District Hospital Sitapur for specialist obstetric/cardiology care. Patient stabilized.');
                      setOutcome('Urgent Transfer to Govt CHC / District Hospital');
                      setActionStatus('action_taken');
                    }}
                  >
                    🚑 Emergency Transfer via 108 to DH
                  </button>
                  <button
                    type="button"
                    className="preset-btn preset-meds"
                    onClick={() => {
                      setClinicianNote('Prescribed essential NHM formulary medication (Tab Amlodipine 5mg / Methyldopa). Instructed ASHA Sunita to re-check BP in 48 hours.');
                      setOutcome('Prescribed Govt Formulary Medicines & Home Care');
                      setActionStatus('reviewed');
                    }}
                  >
                    💊 Prescribe NHM Meds & 48h Follow-up
                  </button>
                  <button
                    type="button"
                    className="preset-btn preset-resolve"
                    onClick={() => {
                      setClinicianNote('Vitals and clinical danger signs reviewed and stabilizing. Safe for routine frontline ASHA worker home visits.');
                      setOutcome('Resolved / Returned to ASHA Routine Follow-up');
                      setActionStatus('closed');
                    }}
                  >
                    ✓ Resolved: Return to Routine ASHA Care
                  </button>
                </div>
              </div>

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
                  <option value="Scheduled In-Clinic Visit at Govt PHC">
                    🏥 Scheduled In-Person OPD at Govt PHC Sitapur (सरकारी प्राथमिक स्वास्थ्य केंद्र)
                  </option>
                  <option value="Urgent Transfer to Govt CHC / District Hospital">
                    🚨 Urgent Transfer to Govt CHC / District Hospital (सरकारी जिला अस्पताल रेफरल)
                  </option>
                  <option value="Prescribed Govt Formulary Medicines & Home Care">
                    💊 Prescribed Free Govt NHM Medicines & Guided Home Care (निःशुल्क सरकारी दवाएं)
                  </option>
                  <option value="Resolved / Returned to ASHA Routine Follow-up">
                    ✓ Resolved / Returned to Frontline ASHA Routine Care (आशा फॉलो-अप)
                  </option>
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

      {/* ABDM HL7 FHIR R4 Export Modal */}
      {selectedFhirModal && (
        <div className="modal-overlay">
          <div className="modal-container fhir-export-modal" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h3>🌐 ABDM / HL7 FHIR R4 Document Bundle</h3>
                <span className="modal-subtitle">
                  Patient: {selectedFhirModal.patient?.pseudonym} · ABHA ID: {selectedFhirModal.patient?.abha_id || 'Auto-Assigned'} · Ayushman Bharat Digital Mission Compatible
                </span>
              </div>
              <button className="btn-close" onClick={() => setSelectedFhirModal(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ marginTop: '0.75rem' }}>
              {selectedFhirModal.loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Generating FHIR R4 Bundle from clinical ledger...</div>
              ) : (
                <>
                  <div className="fhir-spec-banner" style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <p style={{ margin: 0 }}>
                      ✓ Standard: <strong>HL7 FHIR Release 4 (R4) Document Bundle</strong> • Resources: <code>Patient</code>, <code>Observation</code> (LOINC Vitals), <code>RiskAssessment</code>.
                    </p>
                  </div>
                  <pre
                    style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      background: '#0f172a',
                      color: '#38bdf8',
                      padding: '1rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontFamily: 'Consolas, monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {JSON.stringify(selectedFhirModal.bundle, null, 2)}
                  </pre>
                </>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyFhir}
                disabled={selectedFhirModal.loading}
              >
                {selectedFhirModal.copied ? '✓ Copied to Clipboard!' : '📋 Copy FHIR JSON'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadFhir}
                disabled={selectedFhirModal.loading}
              >
                💾 Download FHIR-R4.json
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedFhirModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

