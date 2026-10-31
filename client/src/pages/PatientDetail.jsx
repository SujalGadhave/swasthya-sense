import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/api.js';
import FlagCard from '../components/FlagCard.jsx';
import VitalTrendSparkline from '../components/VitalTrendSparkline.jsx';

export default function PatientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingConsent, setTogglingConsent] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadPatient = async () => {
    setLoading(true);
    try {
      const res = await api.patients.getById(id);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load patient profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  const handleToggleConsent = async () => {
    if (!data?.patient) return;
    setTogglingConsent(true);
    const newStatus = data.patient.consent_status === 'consented' ? 'declined' : 'consented';

    try {
      await api.patients.toggleConsent(id, newStatus);
      setToastMessage(
        `Patient consent updated to: ${newStatus.toUpperCase()}. ${
          newStatus === 'declined' ? 'Automated messaging is now suppressed.' : 'Automated messaging enabled.'
        }`
      );
      loadPatient();
    } catch (err) {
      alert(`Consent update failed: ${err.message}`);
    } finally {
      setTogglingConsent(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="loading-state">Loading patient details...</div></div>;
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error || 'Patient not found'}</div>
        <Link to="/worker" className="btn btn-secondary">← Back to Dashboard</Link>
      </div>
    );
  }

  const { patient, checkIns = [], flags = [] } = data;

  // Extract chronological systolic blood pressure history for visual sparkline
  const systolicHistory = checkIns
    .filter((ci) => {
      const m = typeof ci.measurements === 'string' ? JSON.parse(ci.measurements || '{}') : (ci.measurements || {});
      return m.systolic !== undefined && !isNaN(Number(m.systolic));
    })
    .map((ci) => {
      const m = typeof ci.measurements === 'string' ? JSON.parse(ci.measurements || '{}') : (ci.measurements || {});
      return Number(m.systolic);
    })
    .reverse();

  return (
    <div className="page-container">
      <div className="breadcrumb-nav">
        <Link to="/worker" className="btn-link">← Back to Today's Call List</Link>
      </div>

      {toastMessage && <div className="alert alert-success">{toastMessage}</div>}

      {/* Patient Profile Card */}
      <div className="patient-profile-card">
        <div className="profile-main-flex">
          <div>
            <div className="profile-title-row">
              <h2>{patient.pseudonym}</h2>
              <span className="meta-tag tag-cohort">{patient.cohort?.toUpperCase()} COHORT</span>
            </div>
            <div className="patient-demographics">
              <span>📍 <strong>Village / Ward:</strong> {patient.village_or_ward}</span>
              <span>👤 <strong>Age Band:</strong> {patient.age_band}</span>
              <span>🆔 <strong>Synthetic Registry ID:</strong> <code>{patient.id}</code></span>
            </div>
          </div>

          {/* Consent Status Management */}
          <div className="consent-control-box">
            <span className="control-label">Patient Messaging Consent</span>
            <div className="consent-status-indicator">
              <span className={`status-pill ${patient.consent_status === 'consented' ? 'status-sent' : 'status-suppressed'}`}>
                {patient.consent_status === 'consented' ? '✓ Consented to Reminders' : '✕ Consent Declined'}
              </span>
            </div>
            <p className="consent-help-text">
              {patient.consent_status === 'consented'
                ? 'Patient receives automated simulated SMS reminders for upcoming follow-ups.'
                : 'Automated messaging is strictly suppressed per patient choice.'}
            </p>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleToggleConsent}
              disabled={togglingConsent}
            >
              {togglingConsent ? 'Updating...' : `Toggle to: ${patient.consent_status === 'consented' ? 'Declined' : 'Consented'}`}
            </button>
          </div>
        </div>
      </div>

      {/* Risk Flags History */}
      <div className="content-card">
        <h3>Associated Risk Flags ({flags.length})</h3>
        {flags.length === 0 ? (
          <p className="text-muted">No active or historical risk flags recorded for this patient.</p>
        ) : (
          <div className="flags-stack">
            {flags.map((flag) => (
              <FlagCard key={flag.id} flag={flag} />
            ))}
          </div>
        )}
      </div>

      {/* Visit Timeline */}
      <div className="content-card">
        <h3>Completed Follow-Up Check-In Timeline ({checkIns.length})</h3>

        {systolicHistory.length >= 2 && (
          <div className="patient-detail-trend-box">
            <VitalTrendSparkline
              readings={systolicHistory}
              threshold={140}
              unit="mmHg"
              label="Historical Systolic Blood Pressure"
            />
          </div>
        )}

        {checkIns.length === 0 ? (
          <p className="text-muted">No completed check-in visits recorded yet.</p>
        ) : (
          <div className="checkin-timeline">
            {checkIns.map((ci) => {
              const measurements = typeof ci.measurements === 'string'
                ? JSON.parse(ci.measurements || '{}')
                : (ci.measurements || {});
              const symptoms = typeof ci.symptoms === 'string'
                ? JSON.parse(ci.symptoms || '[]')
                : (ci.symptoms || []);

              return (
                <div key={ci.id} className="timeline-item">
                  <div className="timeline-date">
                    <strong>{ci.completed_at ? new Date(ci.completed_at).toLocaleDateString() : ci.due_date}</strong>
                    <span className="channel-tag">{ci.channel?.replace('_', ' ')?.toUpperCase()}</span>
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-vitals">
                      {measurements.systolic && measurements.diastolic && (
                        <span className="vital-chip">
                          BP: <strong>{measurements.systolic}/{measurements.diastolic} mmHg</strong>
                        </span>
                      )}
                      {measurements.fastingGlucose && (
                        <span className="vital-chip">
                          Fasting Glucose: <strong>{measurements.fastingGlucose} mg/dL</strong>
                        </span>
                      )}
                      {measurements.randomGlucose && (
                        <span className="vital-chip">
                          Random Glucose: <strong>{measurements.randomGlucose} mg/dL</strong>
                        </span>
                      )}
                      {measurements.weightKg && (
                        <span className="vital-chip">
                          Weight: <strong>{measurements.weightKg} kg</strong>
                        </span>
                      )}
                      {measurements.temperatureF && (
                        <span className="vital-chip">
                          Temp: <strong>{measurements.temperatureF} °F</strong>
                        </span>
                      )}
                    </div>

                    {symptoms.length > 0 && (
                      <div className="timeline-symptoms">
                        <strong>Danger Signs Checked:</strong>
                        {symptoms.map((s) => (
                          <span key={s} className="symptom-tag">⚠️ {s.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}

                    {ci.notes && (
                      <p className="timeline-notes">
                        <em>Notes:</em> {ci.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

