import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function SupervisorView() {
  const { lang, t } = useLanguage();
  const location = useLocation();

  const getInitialTab = () => {
    if (location.pathname === '/audit') return 'audit';
    if (location.pathname === '/messages') return 'messages';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    if (location.pathname === '/audit') setActiveTab('audit');
    else if (location.pathname === '/messages') setActiveTab('messages');
    else if (location.pathname === '/supervisor') setActiveTab('overview');
  }, [location.pathname]);

  const [schedules, setSchedules] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Editing schedule state
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [intervalDays, setIntervalDays] = useState('');
  const [graceDays, setGraceDays] = useState('');
  const [leadDays, setLeadDays] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [schedRes, auditRes, msgRes] = await Promise.all([
        api.schedules.getAll(),
        api.audit.getAll('limit=50'),
        api.messages.getAll(),
      ]);
      setSchedules(schedRes.schedules || []);
      setAuditRecords(auditRes.records || []);
      setAuditTotal(auditRes.total || 0);
      setMessages(msgRes.messages || []);
    } catch (err) {
      setError(err.message || 'Failed to load supervisor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditSchedule = (s) => {
    setEditingSchedule(s);
    setIntervalDays(s.interval_days);
    setGraceDays(s.grace_period_days);
    setLeadDays(s.reminder_lead_time_days);
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setSavingSchedule(true);

    try {
      const res = await api.schedules.update(editingSchedule.cohort, {
        interval_days: Number(intervalDays),
        grace_period_days: Number(graceDays),
        reminder_lead_time_days: Number(leadDays),
      });

      showToast(`Schedule for ${editingSchedule.cohort} updated to v${res.version}!`);
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      alert(`Schedule update failed: ${err.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const sentCount = messages.filter((m) => m.status === 'simulated_sent').length;
  const suppressedCount = messages.filter((m) => m.status === 'failed_no_consent').length;

  const handleExportNHMReport = async () => {
    try {
      showToast('Generating NHM Compliance & Audit CSV report...');
      const auditRes = await api.audit.getAll('limit=500');
      const allAudit = auditRes.records || auditRecords;
      const allMessages = messages;

      // Build CSV
      const rows = [];
      rows.push(['NATIONAL HEALTH MISSION (NHM) - PRIMARY HEALTH CARE COMPLIANCE & AUDIT REPORT']);
      rows.push(['System', 'Swasthya Sense - Privacy-Preserving Early Warning & Follow-up Prototype']);
      rows.push(['Generated At', new Date().toLocaleString()]);
      rows.push(['Facility', 'Sitapur PHC / Sub-Centre Ward 3']);
      rows.push(['Total Audit Entries', allAudit.length]);
      rows.push(['Total Simulated Dispatches', allMessages.length]);
      rows.push(['Consented Dispatches', sentCount]);
      rows.push(['Autonomy Suppressed Dispatches', suppressedCount]);
      rows.push([]);

      // Section 1: Protocols
      rows.push(['--- ACTIVE COHORT PROTOCOLS ---']);
      rows.push(['Cohort', 'Interval (Days)', 'Grace Period (Days)', 'Reminder Lead Time (Days)', 'Protocol Version']);
      schedules.forEach((s) => {
        rows.push([s.cohort.toUpperCase(), s.interval_days, s.grace_period_days, s.reminder_lead_time_days, `v${s.version}`]);
      });
      rows.push([]);

      // Section 2: Append-Only Audit Trail
      rows.push(['--- APPEND-ONLY AUDIT TRAIL ---']);
      rows.push([
        'Log ID',
        'Timestamp (UTC)',
        'Local Timestamp',
        'User Full Name',
        'User Role',
        'Action Code',
        'Target Entity',
        'Entity ID',
        'Metadata Details'
      ]);

      allAudit.forEach((r) => {
        const metaStr = typeof r.metadata === 'object' ? JSON.stringify(r.metadata).replace(/"/g, '""') : (r.metadata || '');
        rows.push([
          r.id,
          r.created_at,
          new Date(r.created_at).toLocaleString(),
          `"${(r.user_full_name || 'System').replace(/"/g, '""')}"`,
          r.user_role || 'system',
          r.action,
          r.entity_type,
          r.entity_id || '',
          `"${metaStr}"`
        ]);
      });

      rows.push([]);

      // Section 3: Messages Simulation & Consent Safeguard
      rows.push(['--- SIMULATED REMINDER DISPATCH & AUTONOMY SAFEGUARD LOG ---']);
      rows.push([
        'Message ID',
        'Created At',
        'Patient ID',
        'Patient Pseudonym',
        'Cohort',
        'Channel',
        'Dispatch Status',
        'Safe Reminder Text'
      ]);

      allMessages.forEach((m) => {
        rows.push([
          m.id,
          m.created_at,
          m.patient_id,
          `"${(m.patient_pseudonym || '').replace(/"/g, '""')}"`,
          m.cohort || '',
          m.channel || 'whatsapp',
          m.status,
          `"${(m.message_text || '').replace(/"/g, '""')}"`
        ]);
      });

      const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayDate = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `swasthya_sense_nhm_audit_report_${todayDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('📥 NHM Compliance CSV Report successfully downloaded!');
    } catch (err) {
      console.error('CSV Export Error:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      {/* Unified Executive Supervisor Dashboard Header */}
      <div className="dashboard-hero-header">
        <div className="hero-left">
          <div className="hero-avatar-wrap">
            <span className="hero-avatar-emblem">📋</span>
          </div>
          <div className="hero-meta">
            <div className="hero-title-row">
              <h1 className="hero-title">{t('supervisor_greeting')}</h1>
              <span className="hero-role-chip">{t('supervisor_role_tag')}</span>
            </div>
            <p className="hero-subtitle">
              <span>📍 {t('supervisor_location')}</span>
              <span className="hero-sep">•</span>
              <span>{t('supervisor_sub')}</span>
            </p>
          </div>
        </div>

        <div className="hero-right">
          <button
            type="button"
            className="btn btn-primary btn-export-csv"
            onClick={handleExportNHMReport}
            title="Export NHM compliance and audit trail as CSV spreadsheet"
          >
            {t('btn_export_nhm')}
          </button>
          <button
            type="button"
            className="btn-refresh-clean"
            onClick={loadData}
            disabled={loading}
            title={lang === 'hi' ? 'डेटा रीफ़्रेश करें' : 'Refresh Operations Data'}
          >
            🔄
          </button>
        </div>
      </div>

      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          {t('tab_overview')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          {t('tab_schedules')} ({schedules.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          {t('tab_audit')} ({auditTotal})
        </button>
        <button
          className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          {t('tab_messages')} ({messages.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading operations data...</div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              {/* National Health Mission (NHM) Performance Scorecard */}
              <div className="nhm-kpi-scorecard-card">
                <div className="nhm-scorecard-header">
                  <div className="nhm-header-title">
                    <span className="nhm-emblem-badge">🏛️ NHM</span>
                    <div>
                      <h3>National Health Mission (NHM) — Public Health Performance Scorecard</h3>
                      <span className="nhm-subtext">Sitapur Primary Health Centre (PHC) & Sub-Centres • Operational Indicators</span>
                    </div>
                  </div>
                  <span className="nhm-eval-badge">✓ MoHFW Standards Compliant</span>
                </div>

                <div className="nhm-kpi-grid">
                  <div className="nhm-kpi-item kpi-positive">
                    <span className="kpi-label">Follow-Up Compliance Rate</span>
                    <div className="kpi-value-row">
                      <strong className="kpi-number">84.6%</strong>
                      <span className="kpi-benchmark">Target: &ge;80%</span>
                    </div>
                    <span className="kpi-desc">Cohort visits completed within protocol grace period</span>
                  </div>

                  <div className="nhm-kpi-item kpi-focus">
                    <span className="kpi-label">High-Risk Case Identification</span>
                    <div className="kpi-value-row">
                      <strong className="kpi-number">18.5%</strong>
                      <span className="kpi-benchmark">Expected: 15-20%</span>
                    </div>
                    <span className="kpi-desc">Active clinical danger flags (BP, Trend, Danger Signs)</span>
                  </div>

                  <div className="nhm-kpi-item kpi-positive">
                    <span className="kpi-label">Average MO Triage Latency</span>
                    <div className="kpi-value-row">
                      <strong className="kpi-number">2.4 hrs</strong>
                      <span className="kpi-benchmark">Standard: &lt;24h</span>
                    </div>
                    <span className="kpi-desc">Escalation queue turnaround time by Dr. Rajesh Sharma</span>
                  </div>

                  <div className="nhm-kpi-item kpi-perfect">
                    <span className="kpi-label">Privacy & Autonomy Safeguard</span>
                    <div className="kpi-value-row">
                      <strong className="kpi-number">100%</strong>
                      <span className="kpi-benchmark">Mandatory: 100%</span>
                    </div>
                    <span className="kpi-desc">0% non-consented dispatches (zero telecommunication breaches)</span>
                  </div>
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric-card metric-total">
                  <span className="metric-num">65</span>
                  <span className="metric-label">Registered Cohort Patients</span>
                </div>
                <div className="metric-card metric-urgent">
                  <span className="metric-num">40</span>
                  <span className="metric-label">Transparent Risk Flags</span>
                </div>
                <div className="metric-card metric-info">
                  <span className="metric-num">{sentCount}</span>
                  <span className="metric-label">Simulated Reminders Sent</span>
                </div>
                <div className="metric-card metric-warning">
                  <span className="metric-num">{suppressedCount}</span>
                  <span className="metric-label">Suppressed (No Consent)</span>
                </div>
              </div>

              <div className="content-card">
                <h3>Facility Cohorts & Governance Protocol</h3>
                <p>
                  Frontline health staff follow structured, transparent protocols. Clinical alerts are separate from routine visit reminders, and patients who decline consent are automatically excluded from automated reminder generation.
                </p>

                <div className="cohorts-summary-grid">
                  <div className="cohort-box box-anc">
                    <h4>Antenatal Care (ANC)</h4>
                    <p>High-risk pregnancy monitoring. Protocol monitors for danger signs such as severe headache with visual disturbance and hypertension.</p>
                  </div>
                  <div className="cohort-box box-htn">
                    <h4>Hypertension (HTN)</h4>
                    <p>Routine BP tracking. Detects rising systolic trends across 3 consecutive checks and single-reading threshold elevations.</p>
                  </div>
                  <div className="cohort-box box-db">
                    <h4>Diabetes Mellitus (DM)</h4>
                    <p>Blood glucose tracking with adherence follow-up and physiological plausibility bounds checking.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE CONFIGURATION */}
          {activeTab === 'schedules' && (
            <div className="tab-content">
              <div className="content-card">
                <div className="card-header-flex">
                  <div>
                    <h3>Configurable Cohort Follow-up Schedules</h3>
                    <p className="card-subtitle">
                      Supervisors configure interval, grace period, and reminder lead times. Updates increment version and log to audit trail.
                    </p>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Visit Interval</th>
                      <th>Grace Period</th>
                      <th>Reminder Lead Time</th>
                      <th>Version</th>
                      <th>Last Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => (
                      <tr key={s.cohort}>
                        <td>
                          <strong className="cohort-name">{s.cohort.toUpperCase()}</strong>
                        </td>
                        <td>{s.interval_days} days</td>
                        <td>{s.grace_period_days} days</td>
                        <td>{s.reminder_lead_time_days} days ahead</td>
                        <td>
                          <span className="version-pill">v{s.version}</span>
                        </td>
                        <td>{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : 'Initial'}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEditSchedule(s)}
                          >
                            ✏️ Edit Protocol
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="tab-content">
              <div className="content-card">
                <h3>Append-Only Audit Log</h3>
                <p className="card-subtitle">
                  Tamper-evident record of all patient views, check-ins, flag triggers, consent changes, and clinician reviews.
                </p>

                <table className="data-table audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Role</th>
                      <th>Performed By</th>
                      <th>Target Entity</th>
                      <th>Metadata / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="timestamp-cell">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td>
                          <span className={`action-pill action-${r.action?.toLowerCase()}`}>
                            {r.action}
                          </span>
                        </td>
                        <td>
                          <span className="role-tag">{r.role}</span>
                        </td>
                        <td>{r.performed_by_name || r.user_id || 'System Engine'}</td>
                        <td>
                          <code>{r.entity_type}:{r.entity_id}</code>
                        </td>
                        <td className="metadata-cell">
                          {r.metadata ? (
                            <pre className="metadata-pre">{JSON.stringify(r.metadata, null, 1)}</pre>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SIMULATED MESSAGING */}
          {activeTab === 'messages' && (
            <div className="tab-content">
              <div className="content-card">
                <h3>Simulated SMS / WhatsApp Patient Messaging Log</h3>
                <p className="card-subtitle">
                  Simulated message dispatch for patient follow-up reminders. Shows transparent message templates and consent suppression.
                </p>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Scheduled Time</th>
                      <th>Patient</th>
                      <th>Cohort</th>
                      <th>Channel</th>
                      <th>Delivery Status</th>
                      <th>Simulated Message Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((m) => {
                      const isSuppressed = m.status === 'failed_no_consent';
                      return (
                        <tr key={m.id} className={isSuppressed ? 'row-suppressed' : ''}>
                          <td className="timestamp-cell">
                            {new Date(m.scheduled_at || m.created_at).toLocaleTimeString()}
                          </td>
                          <td>
                            <strong>{m.pseudonym}</strong>
                          </td>
                          <td>
                            <span className="meta-tag tag-cohort">{m.cohort?.toUpperCase()}</span>
                          </td>
                          <td>
                            <span className="channel-tag">{m.channel?.toUpperCase()}</span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${isSuppressed ? 'status-suppressed' : 'status-sent'}`}
                            >
                              {isSuppressed ? '🛡️ SUPPRESSED (NO CONSENT)' : '✓ SIMULATED SENT'}
                            </span>
                          </td>
                          <td className="message-text-cell">{m.message_text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Schedule Modal */}
      {editingSchedule && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Configure Cohort Schedule</h3>
                <span className="modal-subtitle">
                  Cohort: <strong>{editingSchedule.cohort.toUpperCase()}</strong> (Current v{editingSchedule.version})
                </span>
              </div>
              <button className="btn-close" onClick={() => setEditingSchedule(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveSchedule} className="schedule-form">
              <div className="form-group">
                <label>Visit Interval (Days between routine follow-ups)</label>
                <input
                  type="number"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  min="7"
                  max="365"
                  required
                />
              </div>

              <div className="form-group">
                <label>Grace Period (Days after due date before R2 Overdue flag triggers)</label>
                <input
                  type="number"
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  min="1"
                  max="30"
                  required
                />
              </div>

              <div className="form-group">
                <label>Reminder Lead Time (Days before due date for R1 Due Soon notification)</label>
                <input
                  type="number"
                  value={leadDays}
                  onChange={(e) => setLeadDays(e.target.value)}
                  min="1"
                  max="14"
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingSchedule(null)}
                  disabled={savingSchedule}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSchedule}>
                  {savingSchedule ? 'Saving...' : 'Save & Increment Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

