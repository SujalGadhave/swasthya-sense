import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useOffline } from '../context/OfflineContext.jsx';
import FlagCard from '../components/FlagCard.jsx';
import CheckInForm from './CheckInForm.jsx';
import SimulatedMessageModal from '../components/SimulatedMessageModal.jsx';
import OfflineSimulatorModal from '../components/OfflineSimulatorModal.jsx';

export default function WorkerDashboard() {
  const { lang, t } = useLanguage();
  const {
    isOffline,
    toggleOffline,
    queueCount,
    syncQueue,
    syncing,
    syncStatus,
    clearSyncStatus,
    isSimulatorOpen,
    openSimulator,
    closeSimulator,
  } = useOffline();
  const [callList, setCallList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [simpleMode, setSimpleMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPatientForCheckIn, setSelectedPatientForCheckIn] = useState(null);
  const [selectedPatientForMessage, setSelectedPatientForMessage] = useState(null);
  const [escalatingFlag, setEscalatingFlag] = useState(null);
  const [escalateNote, setEscalateNote] = useState('');
  const [referralFacility, setReferralFacility] = useState('Govt Primary Health Centre (PHC Sitapur)');
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
    if (result?.offline) {
      showToast(
        lang === 'hi'
          ? 'चेक-इन ऑफ़लाइन स्थानीय रूप से सहेजा गया। नेटवर्क चालू होने पर सिंक करें।'
          : 'Check-in saved locally on frontline device (Offline Queue). Ready to sync.'
      );
      return;
    }
    const flagCount = result?.flags ? result.flags.length : 0;
    showToast(
      `Check-in recorded successfully! ${flagCount} flag(s) generated. Next follow-up scheduled for ${result?.nextDueDate}.`
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
        worker_note: `[Referral Facility: ${referralFacility}] ${escalateNote}`,
        referral_facility: referralFacility,
      });
      showToast(
        lang === 'hi'
          ? `मरीज़ को ${referralFacility} के सरकारी डॉक्टर (डॉ. राजेश शर्मा) के पास रेफर किया गया!`
          : `Patient successfully referred to ${referralFacility} (Dr. Rajesh Sharma, Govt Medical Officer)!`
      );
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

      {/* Frontline ASHA Welcome Banner & Simple Mode Switcher */}
      <div className="asha-welcome-banner">
        <div className="asha-welcome-left">
          <span className="asha-avatar-circle">👩‍⚕️</span>
          <div>
            <h3 className="asha-greeting-text">{t('asha_greeting')}</h3>
            <span className="asha-location-tag">{t('asha_tagline')}</span>
          </div>
        </div>

        <div className="asha-mode-switch-container">
          <button
            type="button"
            className={`asha-mode-btn ${simpleMode ? 'active-simple' : ''}`}
            onClick={() => setSimpleMode(true)}
            title="Simplified, large-touch visual interface for frontline field visits"
          >
            {t('asha_mode_simple')}
          </button>
          <button
            type="button"
            className={`asha-mode-btn ${!simpleMode ? 'active-detailed' : ''}`}
            onClick={() => setSimpleMode(false)}
            title="Technical protocol tables & detailed filters"
          >
            {t('asha_mode_detailed')}
          </button>
        </div>
      </div>

      {/* Frontline Offline Sync Status Banner */}
      {(isOffline || queueCount > 0) && (
        <div className={`offline-sync-card ${isOffline ? 'mode-offline' : 'mode-queued'}`}>
          <div className="offline-card-left">
            <span className="offline-icon">📡</span>
            <div className="offline-text-block">
              <strong>
                {isOffline
                  ? (lang === 'hi' ? 'फ़ील्ड विज़िट ऑफ़लाइन मोड सक्रिय' : 'Field Visit Offline Mode Active')
                  : (lang === 'hi' ? 'स्थानीय ऑफ़लाइन कतार' : 'Frontline Device Offline Queue')}
              </strong>
              <p>
                {queueCount > 0
                  ? (lang === 'hi'
                      ? `${queueCount} मरीज़ चेक-इन स्थानीय डिवाइस में कतारबद्ध हैं। PHC सर्वर पर अपलोड करने के लिए सिंक दबाएं।`
                      : `${queueCount} check-in(s) queued locally on this device. Click sync to upload to PHC server.`)
                  : (lang === 'hi'
                      ? 'कोई इंटरनेट आवश्यक नहीं है। रिकॉर्ड किए गए चेक-इन स्थानीय रूप से सहेजे जाएंगे।'
                      : 'No active connection needed. Recorded check-ins will be safely cached locally.')}
              </p>
            </div>
          </div>
          <div className="offline-card-actions">
            <button
              type="button"
              className="btn btn-secondary btn-open-sim"
              onClick={openSimulator}
            >
              ⚙️ {lang === 'hi' ? 'सिम्युलेटर कंसोल' : 'Simulator Console'}
            </button>
            {queueCount > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sync-now"
                onClick={async () => {
                  const res = await syncQueue();
                  if (res?.syncedCount > 0) {
                    fetchCallList(filter);
                  }
                }}
                disabled={syncing}
              >
                {syncing
                  ? (lang === 'hi' ? 'सिंक हो रहा है...' : 'Syncing...')
                  : (lang === 'hi' ? `🔄 अभी सिंक करें (${queueCount})` : `🔄 Sync Now (${queueCount})`)}
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-toggle-net"
              onClick={toggleOffline}
            >
              {isOffline
                ? (lang === 'hi' ? 'ऑनलाइन जाएं' : 'Switch Online')
                : (lang === 'hi' ? 'ऑफ़लाइन जाएं' : 'Switch Offline')}
            </button>
          </div>
        </div>
      )}

      {syncStatus && (
        <div className={`alert ${syncStatus.type === 'success' ? 'alert-success' : 'alert-error'} sync-status-alert`}>
          <span>{syncStatus.message}</span>
          <button className="btn-close-sm" onClick={clearSyncStatus}>✕</button>
        </div>
      )}

      {/* SIMPLE ASHA MODE: 3 Big Touch-Friendly Action Cards */}
      {simpleMode ? (
        <div className="asha-simple-priorities-grid">
          {/* Card 1: Urgent Danger */}
          <button
            type="button"
            className={`asha-priority-card card-urgent-bucket ${filter === 'concerning' ? 'active-filter' : ''}`}
            onClick={() => setFilter(filter === 'concerning' ? 'all' : 'concerning')}
          >
            <div className="priority-card-top">
              <span className="priority-badge-icon">🚨</span>
              <span className="priority-big-number">{metrics.concerning}</span>
            </div>
            <strong className="priority-title">{t('urgent_bucket_title')}</strong>
            <p className="priority-subtitle">{t('urgent_bucket_sub')}</p>
            <span className="priority-tap-prompt">
              {filter === 'concerning'
                ? (lang === 'hi' ? '✓ फ़िल्टर सक्रिय (सभी देखने हेतु दबाएं)' : '✓ Filter Active')
                : (lang === 'hi' ? '👉 देखने के लिए दबाएं' : '👉 Tap to view')}
            </span>
          </button>

          {/* Card 2: Overdue */}
          <button
            type="button"
            className={`asha-priority-card card-overdue-bucket ${filter === 'overdue' ? 'active-filter' : ''}`}
            onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
          >
            <div className="priority-card-top">
              <span className="priority-badge-icon">⏳</span>
              <span className="priority-big-number">{metrics.overdue}</span>
            </div>
            <strong className="priority-title">{t('overdue_bucket_title')}</strong>
            <p className="priority-subtitle">{t('overdue_bucket_sub')}</p>
            <span className="priority-tap-prompt">
              {filter === 'overdue'
                ? (lang === 'hi' ? '✓ फ़िल्टर सक्रिय (सभी देखने हेतु दबाएं)' : '✓ Filter Active')
                : (lang === 'hi' ? '👉 देखने के लिए दबाएं' : '👉 Tap to view')}
            </span>
          </button>

          {/* Card 3: Routine Check-Ins */}
          <button
            type="button"
            className={`asha-priority-card card-routine-bucket ${filter === 'all' ? 'active-filter' : ''}`}
            onClick={() => setFilter('all')}
          >
            <div className="priority-card-top">
              <span className="priority-badge-icon">🟢</span>
              <span className="priority-big-number">
                {metrics.dueSoon || (metrics.total - metrics.concerning - metrics.overdue)}
              </span>
            </div>
            <strong className="priority-title">{t('routine_bucket_title')}</strong>
            <p className="priority-subtitle">{t('routine_bucket_sub')}</p>
            <span className="priority-tap-prompt">
              {filter === 'all'
                ? (lang === 'hi' ? '✓ सभी मरीज़ दिख रहे हैं' : '✓ Showing All')
                : (lang === 'hi' ? '👉 सभी मरीज़ देखें' : '👉 Tap to view all')}
            </span>
          </button>
        </div>
      ) : (
        /* DETAILED MODE: Standard 4 metrics and filter chips */
        <>
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
        </>
      )}

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
                      <div className="patient-avatar-title-group">
                        <span className="cohort-avatar-circle">
                          {patient.cohort === 'antenatal' ? '🤰' : patient.cohort === 'hypertension' ? '🫀' : '🩸'}
                        </span>
                        <div>
                          <strong className="patient-simple-name">{patient.pseudonym}</strong>
                          <span className="patient-cohort-simple">
                            {patient.cohort === 'antenatal'
                              ? t('cohort_antenatal_label')
                              : patient.cohort === 'hypertension'
                              ? t('cohort_hypertension_label')
                              : t('cohort_diabetes_label')}
                          </span>
                        </div>
                      </div>

                      <span className={`priority-pill priority-rank-${patient.priorityRank}`}>
                        {getPriorityLabel(patient.priorityRank, patient.priorityLabel)}
                      </span>
                    </div>

                    <div className="patient-meta-tags">
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
                <div className="call-card-actions asha-touch-actions">
                  <button
                    className="btn btn-primary asha-btn-record"
                    onClick={() => setSelectedPatientForCheckIn(patient)}
                  >
                    🏠 {lang === 'hi' ? 'घर पर जांच करें' : 'Record Check-In'}
                  </button>

                  <a
                    href="tel:9876543210"
                    className="btn btn-secondary asha-btn-call"
                    title="Call patient"
                  >
                    📞 {lang === 'hi' ? 'फोन करें' : 'Call'}
                  </a>

                  <button
                    type="button"
                    className="btn btn-secondary btn-msg-preview asha-btn-msg"
                    onClick={() => setSelectedPatientForMessage(patient)}
                    title="Preview patient SMS / WhatsApp follow-up reminder"
                  >
                    💬 {lang === 'hi' ? 'व्हाट्सएप' : 'WhatsApp'}
                  </button>

                  {/* If patient has clinical flag, prominent doctor escalate button */}
                  {patient.flags?.some((f) => f.type === 'clinical' && f.status === 'active') && (
                    <button
                      type="button"
                      className="btn btn-escalate asha-btn-quick-esc"
                      onClick={() => {
                        const clinFlag = patient.flags.find((f) => f.type === 'clinical' && f.status === 'active');
                        if (clinFlag) setEscalatingFlag(clinFlag);
                      }}
                    >
                      🩺 {lang === 'hi' ? 'डॉक्टर को भेजें' : 'Send to Doctor'}
                    </button>
                  )}

                  {!simpleMode && (
                    <Link to={`/patient/${patient.patient_id}`} className="btn btn-outline">
                      {t('view_timeline_btn')}
                    </Link>
                  )}
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

      {/* Escalation Modal - Official Government Hospital & Medical Officer Referral */}
      {escalatingFlag && (
        <div className="modal-overlay">
          <div className="modal-container govt-referral-modal">
            <div className="modal-header">
              <div>
                <div className="govt-badge-header">
                  <span className="govt-emblem">🏛️</span>
                  <h3>
                    {lang === 'hi'
                      ? 'सरकारी अस्पताल एवं डॉक्टर को रेफर करें'
                      : 'Refer to Government Hospital & Medical Officer'}
                  </h3>
                </div>
                <span className="modal-subtitle">
                  {lang === 'hi' ? 'जोखिम लक्षण:' : 'Flag:'} {escalatingFlag.explanation || `Rule ${escalatingFlag.rule_id}`}
                </span>
              </div>
              <button className="btn-close" onClick={() => setEscalatingFlag(null)}>✕</button>
            </div>

            {/* Official NHM Free Healthcare Assurance Banner */}
            <div className="nhm-assurance-banner">
              <strong>🏛️ {lang === 'hi' ? 'राष्ट्रीय स्वास्थ्य मिशन (NHM) नियम:' : 'National Health Mission (NHM) Protocol:'}</strong>{' '}
              {lang === 'hi'
                ? 'सरकारी अस्पताल (PHC / CHC / जिला अस्पताल) में सभी परामर्श, पैथोलॉजी जांचें एवं दवाइयां पूर्णतः निःशुल्क हैं।'
                : 'All consultations, diagnostics, and medicines at Government PHC / CHC / District Hospitals are 100% free of cost.'}
            </div>

            <form onSubmit={handleEscalateSubmit} className="escalate-modal-form">
              {/* Select Government Health Facility Tier */}
              <div className="form-group">
                <label className="govt-label">
                  🏥 {lang === 'hi' ? 'रेफरल हेतु सरकारी स्वास्थ्य केंद्र चुनें:' : 'Target Government Health Facility:'}
                </label>
                <select
                  value={referralFacility}
                  onChange={(e) => setReferralFacility(e.target.value)}
                  className="govt-select-input"
                >
                  <option value="Govt Primary Health Centre (PHC Sitapur)">
                    🏥 {lang === 'hi' ? 'सरकारी प्राथमिक स्वास्थ्य केंद्र (PHC सीतापुर) - डॉ. राजेश शर्मा' : 'Govt Primary Health Centre (PHC Sitapur) - Dr. Rajesh Sharma'}
                  </option>
                  <option value="Govt Community Health Centre (CHC Sitapur)">
                    🏥 {lang === 'hi' ? 'सरकारी सामुदायिक स्वास्थ्य केंद्र (CHC सीतापुर) - 24x7 आपातकालीन ओपीडी' : 'Govt Community Health Centre (CHC Sitapur) - 24x7 Emergency OPD'}
                  </option>
                  <option value="Govt District Hospital (Sitapur DH)">
                    🏥 {lang === 'hi' ? 'सरकारी जिला अस्पताल (District Hospital Sitapur) - विशेषज्ञ वार्ड' : 'Govt District Hospital (Sitapur DH) - Specialist High-Risk Unit'}
                  </option>
                </select>
              </div>

              {/* Designated Government Medical Officer */}
              <div className="form-group">
                <label className="govt-label">
                  🩺 {lang === 'hi' ? 'नामित सरकारी चिकित्सा अधिकारी (Medical Officer):' : 'Assigned Government Medical Officer:'}
                </label>
                <div className="govt-doctor-card">
                  <span className="doc-avatar">👨‍⚕️</span>
                  <div>
                    <strong>Dr. Rajesh Sharma, MBBS</strong>
                    <span className="doc-designation">
                      {lang === 'hi'
                        ? 'सरकारी चिकित्सा अधिकारी · प्राथमिक स्वास्थ्य केंद्र (PHC सीतापुर)'
                        : 'Govt Medical Officer · Primary Health Centre (PHC Sitapur)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick 1-Tap Referral Reasons */}
              <div className="form-group">
                <label className="govt-label">
                  ⚡ {lang === 'hi' ? 'त्वरित रेफरल कारण (दबाकर जोड़ें):' : 'Quick Referral Reasons (Tap to add):'}
                </label>
                <div className="quick-referral-pills">
                  <button
                    type="button"
                    className="referral-pill"
                    onClick={() => setEscalateNote((prev) => prev ? `${prev}. तेज सिरदर्द एवं बीपी अधिक है` : 'तेज सिरदर्द एवं बीपी अधिक है')}
                  >
                    + 🚨 {lang === 'hi' ? 'बीपी खतरनाक स्तर पर' : 'Severe High BP'}
                  </button>
                  <button
                    type="button"
                    className="referral-pill"
                    onClick={() => setEscalateNote((prev) => prev ? `${prev}. गर्भावस्था में खतरे के लक्षण (ANC Alert)` : 'गर्भावस्था में खतरे के लक्षण (ANC Alert)')}
                  >
                    + 🤰 {lang === 'hi' ? 'गर्भावस्था खतरे के लक्षण' : 'ANC Danger Sign'}
                  </button>
                  <button
                    type="button"
                    className="referral-pill"
                    onClick={() => setEscalateNote((prev) => prev ? `${prev}. तुरंत 108 एम्बुलेंस द्वारा सरकारी अस्पताल भेजा गया` : 'तुरंत 108 एम्बुलेंस द्वारा सरकारी अस्पताल भेजा गया')}
                  >
                    + 🚑 {lang === 'hi' ? '108 एम्बुलेंस द्वारा भेजा' : 'Referred via 108 Ambulance'}
                  </button>
                  <button
                    type="button"
                    className="referral-pill"
                    onClick={() => setEscalateNote((prev) => prev ? `${prev}. मरीज़ को तुरंत सरकारी अस्पताल ओपीडी में मिलने को कहा` : 'मरीज़ को तुरंत सरकारी अस्पताल ओपीडी में मिलने को कहा')}
                  >
                    + 🏥 {lang === 'hi' ? 'सरकारी ओपीडी जाने को कहा' : 'Advised Govt OPD visit'}
                  </button>
                </div>

                <textarea
                  rows="3"
                  placeholder={
                    lang === 'hi'
                      ? 'सरकारी डॉक्टर के लिए लक्षण व कारण दर्ज करें...'
                      : 'Describe patient symptoms or reasons requiring Government Hospital clinician review...'
                  }
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  className="govt-textarea"
                  required
                />
              </div>

              <div className="prototype-notice-box">
                ℹ️ <em>
                  {lang === 'hi'
                    ? 'पुष्टि करने पर यह केस सीधे सरकारी डॉक्टर की समीक्षा कतार में दर्ज हो जाएगा।'
                    : 'Confirming routes this case directly into the official Government Medical Officer review queue under NHM guidelines.'}
                </em>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEscalatingFlag(null)}
                  disabled={submittingEscalation}
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn asha-btn-submit-govt"
                  disabled={submittingEscalation}
                >
                  {submittingEscalation
                    ? (lang === 'hi' ? 'रेफर किया जा रहा है...' : 'Submitting Referral...')
                    : (lang === 'hi' ? '🏥 सरकारी अस्पताल व डॉक्टर को रेफर करें' : '🏥 Confirm Referral to Govt Hospital & Doctor')}
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

      {/* Rural Low-Bandwidth & Offline-Sync Simulator Modal */}
      {isSimulatorOpen && (
        <OfflineSimulatorModal
          onClose={closeSimulator}
          onSyncComplete={() => fetchCallList(filter)}
        />
      )}
    </div>
  );
}

