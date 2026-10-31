import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useOffline } from '../context/OfflineContext.jsx';
import FlagCard, { getFlagExplanation } from '../components/FlagCard.jsx';
import CheckInForm from './CheckInForm.jsx';
import SimulatedMessageModal from '../components/SimulatedMessageModal.jsx';
import { getPatientDisplayName, getLocalizedVillage, getLocalizedAgeBand } from '../utils/patientNames.js';
import { speakText, stopSpeech, getPatientVoicePrompt } from '../utils/speechHelper.js';

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
  } = useOffline();
  const [callList, setCallList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [sortMode, setSortMode] = useState('urgency');
  const [simpleMode, setSimpleMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [speakingPatientId, setSpeakingPatientId] = useState(null);
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
    return () => {
      stopSpeech();
    };
  }, [filter]);

  const handleSpeakPatient = (patient) => {
    if (speakingPatientId === patient.patient_id) {
      stopSpeech();
      setSpeakingPatientId(null);
      return;
    }
    stopSpeech();
    const script = getPatientVoicePrompt(patient, lang);
    setSpeakingPatientId(patient.patient_id);
    speakText(script, lang, () => setSpeakingPatientId(null));
  };

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

  const getPatientVitalsSummary = (patient) => {
    for (const flag of patient.flags || []) {
      const tv = flag.triggering_values || {};
      if (tv.systolic && tv.diastolic) {
        return `BP: ${tv.systolic}/${tv.diastolic} mmHg`;
      }
      if (Array.isArray(tv.systolicTrend) && tv.systolicTrend.length > 0) {
        return `Trend: ${tv.systolicTrend.join(' → ')} mmHg`;
      }
      if (tv.randomGlucose || tv.fastingGlucose) {
        return `Glucose: ${tv.randomGlucose || tv.fastingGlucose} mg/dL`;
      }
      if (tv.dangerSigns && Array.isArray(tv.dangerSigns) && tv.dangerSigns.length > 0) {
        return `Signs: ${tv.dangerSigns.join(', ')}`;
      }
    }
    return null;
  };

  const displayedPatients = callList.filter((patient) => {
    if (cohortFilter !== 'all' && patient.cohort !== cohortFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameHi = getPatientDisplayName(patient.pseudonym, 'hi').toLowerCase();
      const nameEn = getPatientDisplayName(patient.pseudonym, 'en').toLowerCase();
      const pseudo = (patient.pseudonym || '').toLowerCase();
      const village = (patient.village_or_ward || '').toLowerCase();
      const abha = (patient.abha_id || '').toLowerCase();
      return nameHi.includes(q) || nameEn.includes(q) || pseudo.includes(q) || village.includes(q) || abha.includes(q);
    }
    return true;
  });

  const sortedPatients = [...displayedPatients].sort((a, b) => {
    if (sortMode === 'proximity') {
      const wardCmp = (a.village_or_ward || '').localeCompare(b.village_or_ward || '');
      if (wardCmp !== 0) return wardCmp;
      return a.priorityRank - b.priorityRank;
    }
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return (b.days_overdue || 0) - (a.days_overdue || 0);
  });

  return (
    <div className="page-container">
      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Unified Executive Frontline Dashboard Header */}
      <div className="dashboard-hero-header">
        <div className="hero-left">
          <div className="hero-avatar-wrap">
            <span className="hero-avatar-emblem">👩‍⚕️</span>
          </div>
          <div className="hero-meta">
            <div className="hero-title-row">
              <h1 className="hero-title">{lang === 'hi' ? 'नमस्ते, सुनीता दीदी' : 'Namaste, Sunita Didi'}</h1>
              <span className="hero-role-chip">{lang === 'hi' ? 'आशा कार्यकर्ता' : 'ASHA Frontline'}</span>
            </div>
            <p className="hero-subtitle">
              <span>📍 Ward 3 · PHC Sitapur</span>
              <span className="hero-sep">•</span>
              <span>{lang === 'hi' ? 'आज की प्राथमिकता सुबह की फॉलो-अप कॉल सूची' : "Today's Prioritized Morning Call List"}</span>
            </p>
          </div>
        </div>

        <div className="hero-right">
          {/* Integrated Offline / Sync Status Pill */}
          {(isOffline || queueCount > 0) && (
            <div className={`hero-sync-pill ${isOffline ? 'is-offline' : 'has-queue'}`}>
              <span className="sync-pill-dot">{isOffline ? '📡' : '💾'}</span>
              <span className="sync-pill-text">
                {queueCount > 0
                  ? `${queueCount} ${lang === 'hi' ? 'ऑफ़लाइन कतार' : 'queued'}`
                  : (lang === 'hi' ? 'ऑफ़लाइन सक्रिय' : 'Offline Active')}
              </span>
              {queueCount > 0 && (
                <button
                  type="button"
                  className="btn-hero-sync"
                  onClick={async () => {
                    const res = await syncQueue();
                    if (res?.syncedCount > 0) fetchCallList(filter);
                  }}
                  disabled={syncing}
                  title="Upload queued records to central server"
                >
                  {syncing ? '...' : (lang === 'hi' ? '🔄 सिंक' : '🔄 Sync')}
                </button>
              )}
              <button
                type="button"
                className="btn-hero-net-toggle"
                onClick={toggleOffline}
                title={isOffline ? 'Switch Online' : 'Switch Offline'}
              >
                {isOffline ? '🌐 Online' : '📡 Offline'}
              </button>
            </div>
          )}

          {/* Segmented View Mode Switcher */}
          <div className="view-mode-pill-toggle" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`view-pill-btn ${simpleMode ? 'is-selected' : ''}`}
              onClick={() => setSimpleMode(true)}
              title="Clean frontline touch cards"
            >
              ✨ {lang === 'hi' ? 'सरल आशा' : 'Simple ASHA'}
            </button>
            <button
              type="button"
              className={`view-pill-btn ${!simpleMode ? 'is-selected' : ''}`}
              onClick={() => setSimpleMode(false)}
              title="Technical protocol metrics"
            >
              📊 {lang === 'hi' ? 'विस्तृत' : 'Detailed'}
            </button>
          </div>

          <button
            type="button"
            className="btn-refresh-clean"
            onClick={() => fetchCallList(filter)}
            disabled={loading}
            title={lang === 'hi' ? 'सूची रीफ़्रेश करें' : 'Refresh list'}
          >
            🔄
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className={`alert ${syncStatus.type === 'success' ? 'alert-success' : 'alert-error'} sync-status-alert`}>
          <span>{syncStatus.message}</span>
          <button className="btn-close-sm" onClick={clearSyncStatus}>✕</button>
        </div>
      )}

      {/* SIMPLE ASHA MODE: Modern Clinical KPI Action Cards */}
      {simpleMode ? (
        <div className="triage-kpi-grid">
          {/* Card 1: Urgent Danger */}
          <button
            type="button"
            className={`triage-kpi-card kpi-danger ${filter === 'concerning' ? 'is-active' : ''}`}
            onClick={() => setFilter(filter === 'concerning' ? 'all' : 'concerning')}
          >
            <div className="kpi-top">
              <span className="kpi-icon-wrap icon-danger">🚨</span>
              <span className="kpi-value">{metrics.concerning}</span>
            </div>
            <div className="kpi-body">
              <strong className="kpi-label">{t('urgent_bucket_title')}</strong>
              <p className="kpi-subtext">{t('urgent_bucket_sub')}</p>
            </div>
            <div className="kpi-footer">
              <span className="kpi-status-tag">
                {filter === 'concerning'
                  ? (lang === 'hi' ? '✓ फ़िल्टर सक्रिय' : '✓ Filter Active')
                  : (lang === 'hi' ? '👉 मरीज़ देखें' : '👉 View Patients')}
              </span>
            </div>
          </button>

          {/* Card 2: Overdue Missed Visits */}
          <button
            type="button"
            className={`triage-kpi-card kpi-warning ${filter === 'overdue' ? 'is-active' : ''}`}
            onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
          >
            <div className="kpi-top">
              <span className="kpi-icon-wrap icon-warning">⏳</span>
              <span className="kpi-value">{metrics.overdue}</span>
            </div>
            <div className="kpi-body">
              <strong className="kpi-label">{t('overdue_bucket_title')}</strong>
              <p className="kpi-subtext">{t('overdue_bucket_sub')}</p>
            </div>
            <div className="kpi-footer">
              <span className="kpi-status-tag">
                {filter === 'overdue'
                  ? (lang === 'hi' ? '✓ फ़िल्टर सक्रिय' : '✓ Filter Active')
                  : (lang === 'hi' ? '👉 मरीज़ देखें' : '👉 View Patients')}
              </span>
            </div>
          </button>

          {/* Card 3: Routine Check-Ins */}
          <button
            type="button"
            className={`triage-kpi-card kpi-normal ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <div className="kpi-top">
              <span className="kpi-icon-wrap icon-normal">🟢</span>
              <span className="kpi-value">
                {metrics.dueSoon || (metrics.total - metrics.concerning - metrics.overdue)}
              </span>
            </div>
            <div className="kpi-body">
              <strong className="kpi-label">{t('routine_bucket_title')}</strong>
              <p className="kpi-subtext">{t('routine_bucket_sub')}</p>
            </div>
            <div className="kpi-footer">
              <span className="kpi-status-tag">
                {filter === 'all'
                  ? (lang === 'hi' ? '✓ सभी दिख रहे हैं' : '✓ Showing All')
                  : (lang === 'hi' ? '👉 सभी देखें' : '👉 View All')}
              </span>
            </div>
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

      {/* Live Interactive Search & Program Filter Toolbar */}
      <div className="call-list-toolbar">
        <div className="search-box-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input-clean"
            placeholder={lang === 'hi' ? 'मरीज़ का नाम, उपनाम या गाँव खोजें...' : 'Search patient name, ID, or village...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="cohort-pills-bar" role="group" aria-label="Program Filter">
          <button
            type="button"
            className={`cohort-pill-btn ${cohortFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setCohortFilter('all')}
          >
            {lang === 'hi' ? 'सभी कार्यक्रम' : 'All Programs'} ({callList.length})
          </button>
          <button
            type="button"
            className={`cohort-pill-btn ${cohortFilter === 'antenatal' ? 'is-active' : ''}`}
            onClick={() => setCohortFilter('antenatal')}
          >
            🤰 {lang === 'hi' ? 'गर्भवती (ANC)' : 'Antenatal'}
          </button>
          <button
            type="button"
            className={`cohort-pill-btn ${cohortFilter === 'hypertension' ? 'is-active' : ''}`}
            onClick={() => setCohortFilter('hypertension')}
          >
            🫀 {lang === 'hi' ? 'रक्तचाप (HTN)' : 'Hypertension'}
          </button>
          <button
            type="button"
            className={`cohort-pill-btn ${cohortFilter === 'diabetes' ? 'is-active' : ''}`}
            onClick={() => setCohortFilter('diabetes')}
          >
            🩸 {lang === 'hi' ? 'मधुमेह (Sugar)' : 'Diabetes'}
          </button>
        </div>

        {/* Route Optimization vs Urgency Sorting Bar */}
        <div className="route-sort-controls" role="group" aria-label="Route Order">
          <button
            type="button"
            className={`route-sort-btn ${sortMode === 'urgency' ? 'is-active' : ''}`}
            onClick={() => setSortMode('urgency')}
            title="Sort by highest clinical risk and overdue severity"
          >
            🚨 {lang === 'hi' ? 'खतरे / प्राथमिकता अनुसार' : 'Urgency Ranked'}
          </button>
          <button
            type="button"
            className={`route-sort-btn ${sortMode === 'proximity' ? 'is-active' : ''}`}
            onClick={() => setSortMode('proximity')}
            title="Group by village ward for shortest walking path"
          >
            🚶 {lang === 'hi' ? 'गांव / वार्ड अनुसार (पैदल मार्ग)' : 'Doorstep Walking Route'}
          </button>
        </div>
      </div>

      {/* Prioritized Patient Call List with Shimmer Skeletons */}
      {loading ? (
        <div className="skeleton-cards-stack">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton-card">
              <div className="skeleton-header-row">
                <div className="skeleton-avatar skeleton-shimmer"></div>
                <div className="skeleton-meta-col">
                  <div className="skeleton-line skeleton-title skeleton-shimmer"></div>
                  <div className="skeleton-line skeleton-sub skeleton-shimmer"></div>
                </div>
              </div>
              <div className="skeleton-line skeleton-body skeleton-shimmer"></div>
              <div className="skeleton-actions-row">
                <div className="skeleton-btn skeleton-shimmer"></div>
                <div className="skeleton-btn skeleton-shimmer"></div>
                <div className="skeleton-btn skeleton-shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedPatients.length === 0 ? (
        <div className="empty-state">
          <h3>{lang === 'hi' ? 'कोई मरीज़ नहीं मिला' : 'No matching patients found'}</h3>
          <p>{lang === 'hi' ? 'खोज या फ़िल्टर बदलकर दोबारा प्रयास करें।' : 'Try adjusting your search query or cohort filter.'}</p>
        </div>
      ) : (
        <div className="call-list-grid">
          {sortedPatients.map((patient) => {
            const hasClinical = patient.priorityRank === 1;
            const hasOverdue = patient.priorityRank === 2 || patient.priorityRank === 3;
            const displayName = getPatientDisplayName(patient.pseudonym, lang);
            const localizedVillage = getLocalizedVillage(patient.village_or_ward, lang);
            const localizedAge = getLocalizedAgeBand(patient.age_band, lang);
            const vitalsTag = getPatientVitalsSummary(patient);

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
                          <div className="patient-name-container">
                            <strong className="patient-simple-name">{displayName}</strong>
                            <span className="patient-id-badge">{patient.pseudonym}</span>
                            <button
                              type="button"
                              className={`btn-speech-read ${speakingPatientId === patient.patient_id ? 'is-speaking' : ''}`}
                              onClick={() => handleSpeakPatient(patient)}
                              title={lang === 'hi' ? 'आवाज़ में सुनें' : 'Listen audio summary'}
                              aria-label="Listen audio summary"
                            >
                              {speakingPatientId === patient.patient_id ? (
                                <span className="soundwave-wrap">
                                  <span className="wave-bar wb1"></span>
                                  <span className="wave-bar wb2"></span>
                                  <span className="wave-bar wb3"></span>
                                  <span className="sound-text">{lang === 'hi' ? 'बोल रहे हैं...' : 'Speaking...'}</span>
                                </span>
                              ) : (
                                <span>🔊 {lang === 'hi' ? 'सुनो' : 'Listen'}</span>
                              )}
                            </button>
                          </div>
                          <div className="patient-badges-subline">
                            <span className="patient-cohort-simple">
                              {patient.cohort === 'antenatal'
                                ? t('cohort_antenatal_label')
                                : patient.cohort === 'hypertension'
                                ? t('cohort_hypertension_label')
                                : t('cohort_diabetes_label')}
                            </span>
                            {vitalsTag && (
                              <span className={`vital-tag-pill ${hasClinical ? 'vital-danger-tag' : 'vital-info-tag'}`}>
                                ⚡ {vitalsTag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className={`priority-pill priority-rank-${patient.priorityRank}`}>
                        {getPriorityLabel(patient.priorityRank, patient.priorityLabel)}
                      </span>
                    </div>

                    <div className="patient-meta-tags">
                      <span className="meta-tag tag-location">📍 {localizedVillage}</span>
                      <span className="meta-tag tag-age">👤 {localizedAge}</span>
                      {patient.abha_id && (
                        <span className="meta-tag tag-abha" title="Ayushman Bharat Health Account ID">
                          🆔 ABHA: {patient.abha_id}
                        </span>
                      )}
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
                      <span className="text-muted">{t('no_scheduled_checkin')}</span>
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
                    ↗ {t('escalation_status_label')}{' '}
                    <strong>
                      {patient.escalation_status === 'pending'
                        ? (lang === 'hi' ? 'लंबित' : 'PENDING')
                        : patient.escalation_status.toUpperCase()}
                    </strong>
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

                  {/* If patient has clinical flag, prominent government doctor escalate button */}
                  {patient.flags?.some((f) => f.type === 'clinical' && f.status === 'active') && (
                    <button
                      type="button"
                      className="btn btn-escalate asha-btn-quick-esc"
                      onClick={() => {
                        const clinFlag = patient.flags.find((f) => f.type === 'clinical' && f.status === 'active');
                        if (clinFlag) setEscalatingFlag(clinFlag);
                      }}
                      title={lang === 'hi' ? 'प्राथमिक स्वास्थ्य केंद्र (PHC) सरकारी डॉक्टर को रेफर करें' : 'Refer patient to Govt PHC Doctor'}
                    >
                      🏛️ {lang === 'hi' ? 'सरकारी डॉक्टर को रेफर करें' : 'Refer to Govt Doctor'}
                    </button>
                  )}

                  {/* If patient has acute danger flag, prominent 108 Emergency Ambulance dial button */}
                  {patient.flags?.some(
                    (f) => f.type === 'clinical' && (f.severity === 'urgent' || f.rule_id === 'R6')
                  ) && (
                    <a
                      href="tel:108"
                      className="btn btn-emergency-108 asha-btn-108"
                      onClick={() => {
                        showToast(
                          lang === 'hi'
                            ? `🚑 108 आपातकालीन एम्बुलेंस सेवा डायल की जा रही है (${displayName})`
                            : `🚑 Dialing 108 Emergency Ambulance for ${displayName}`
                        );
                      }}
                      title="108 Free Emergency Ambulance (NHM Govt Service)"
                    >
                      🚑 {lang === 'hi' ? '108 एम्बुलेंस' : 'Dial 108'}
                    </a>
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
                  {lang === 'hi' ? 'जोखिम लक्षण:' : 'Flag:'} {getFlagExplanation(escalatingFlag, lang)}
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
    </div>
  );
}

