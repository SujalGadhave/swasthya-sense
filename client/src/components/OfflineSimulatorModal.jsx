import React, { useState, useEffect, useRef } from 'react';
import { useOffline } from '../context/OfflineContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../api/api.js';

export default function OfflineSimulatorModal({ onClose, onSyncComplete }) {
  const { lang } = useLanguage();
  const {
    networkProfile,
    changeNetworkProfile,
    queue,
    queueCount,
    populateSyntheticBatch,
    replaySyncWithSimulation,
    clearQueue,
    removeQueueItem,
    syncing,
  } = useOffline();

  const [availablePatients, setAvailablePatients] = useState([]);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const terminalRef = useRef(null);

  // Fetch some patients from backend for realistic synthetic batch generation
  useEffect(() => {
    api.patients.getAll()
      .then((res) => setAvailablePatients(res.patients || []))
      .catch(() => {});
  }, []);

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [telemetryLogs]);

  const handlePopulateDemo = () => {
    populateSyntheticBatch(availablePatients);
    setTelemetryLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 📝 Generated 3 realistic rural check-in payloads (Antenatal, Hypertension, Diabetes) into local device storage.`,
    ]);
  };

  const handleStartSimulation = async () => {
    if (queue.length === 0) return;
    setSyncProgress(0);
    setTelemetryLogs([
      `[${new Date().toLocaleTimeString()}] 🚀 Starting rural sync sequence with profile: ${networkProfile.toUpperCase()}...`,
    ]);

    const result = await replaySyncWithSimulation((step) => {
      setSyncProgress(step.percent);
      setTelemetryLogs((prev) => [...prev, step.message]);
    });

    if (result.success && onSyncComplete) {
      onSyncComplete(result);
    }
  };

  const totalBytes = queue.reduce((sum, item) => sum + (item.bytes || 320), 0);

  return (
    <div className="modal-overlay">
      <div className="modal-container simulator-modal-container">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="sim-badge-row">
              <h3>📡 Offline-Sync Queue Simulator</h3>
              <span className="sim-tag">Rural Low-Bandwidth Resilience</span>
            </div>
            <p className="modal-subtitle">
              Interactive testbench demonstrating offline-first data capture, bandwidth-minimized JSON payloads, and transactional replay for remote sub-centres.
            </p>
          </div>
          <button className="btn-close" onClick={onClose} disabled={syncing}>✕</button>
        </div>

        {/* Network Profile Switcher */}
        <div className="sim-section">
          <label className="sim-section-label">1. Select Simulated Network Profile:</label>
          <div className="network-profiles-grid">
            <button
              type="button"
              className={`profile-card ${networkProfile === 'online_4g' ? 'selected green' : ''}`}
              onClick={() => changeNetworkProfile('online_4g')}
              disabled={syncing}
            >
              <div className="profile-header">
                <span className="profile-icon">🟢</span>
                <strong>4G / PHC Wi-Fi</strong>
              </div>
              <p className="profile-desc">Normal fast connection. 50ms latency, zero packet loss.</p>
              <span className="profile-metric">Ping: ~30ms · 100% OK</span>
            </button>

            <button
              type="button"
              className={`profile-card ${networkProfile === 'rural_2g' ? 'selected amber' : ''}`}
              onClick={() => changeNetworkProfile('rural_2g')}
              disabled={syncing}
            >
              <div className="profile-header">
                <span className="profile-icon">🟡</span>
                <strong>Rural 2G / EDGE</strong>
              </div>
              <p className="profile-desc">High latency, serial packet throttling. Simulates remote village reception.</p>
              <span className="profile-metric">Ping: ~900ms · Throttled</span>
            </button>

            <button
              type="button"
              className={`profile-card ${networkProfile === 'flaky_tower' ? 'selected orange' : ''}`}
              onClick={() => changeNetworkProfile('flaky_tower')}
              disabled={syncing}
            >
              <div className="profile-header">
                <span className="profile-icon">⚡</span>
                <strong>Flaky Rural Tower</strong>
              </div>
              <p className="profile-desc">Intermittent signal drops with automatic exponential backoff retry.</p>
              <span className="profile-metric">Packet Retry Simulator</span>
            </button>

            <button
              type="button"
              className={`profile-card ${networkProfile === 'offline_zero' ? 'selected red' : ''}`}
              onClick={() => changeNetworkProfile('offline_zero')}
              disabled={syncing}
            >
              <div className="profile-header">
                <span className="profile-icon">🔴</span>
                <strong>Deep Village (Offline)</strong>
              </div>
              <p className="profile-desc">100% disconnected. All frontline check-ins queue safely on device.</p>
              <span className="profile-metric">Disconnected · Queue Active</span>
            </button>
          </div>
        </div>

        {/* Telemetry Summary Bar */}
        <div className="sim-metrics-bar">
          <div className="sim-metric-item">
            <span className="sim-m-label">Queued Records</span>
            <strong className="sim-m-val">{queueCount}</strong>
          </div>
          <div className="sim-metric-item">
            <span className="sim-m-label">Total Storage Footprint</span>
            <strong className="sim-m-val">{totalBytes} Bytes ({((totalBytes / 1024)).toFixed(2)} KB)</strong>
          </div>
          <div className="sim-metric-item">
            <span className="sim-m-label">Bandwidth Efficiency</span>
            <strong className="sim-m-val">~320 B / check-in</strong>
          </div>
          <div className="sim-metric-item">
            <span className="sim-m-label">Current State</span>
            <span className={`sim-state-chip ${networkProfile}`}>
              {networkProfile.toUpperCase().replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Queue Management & Demo Buttons */}
        <div className="sim-queue-actions">
          <div className="queue-action-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-demo-populate"
              onClick={handlePopulateDemo}
              disabled={syncing}
              title="Populate 3 realistic synthetic village check-ins to demonstrate the queue"
            >
              ⚡ Populate 3 Synthetic Village Check-Ins
            </button>

            {queueCount > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-clear-queue"
                onClick={clearQueue}
                disabled={syncing}
              >
                🗑️ Clear Queue
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-run-sync"
            onClick={handleStartSimulation}
            disabled={syncing || queueCount === 0 || networkProfile === 'offline_zero'}
            title={networkProfile === 'offline_zero' ? 'Switch to 4G or 2G to replay queue' : 'Replay queued check-ins to backend'}
          >
            {syncing
              ? '⏳ Replaying Queue Telemetry...'
              : networkProfile === 'offline_zero'
              ? '🚫 Switch Online to Replay'
              : `▶ Run Animated Sync Simulation (${queueCount})`}
          </button>
        </div>

        {/* Queued Items Table */}
        <div className="sim-section">
          <label className="sim-section-label">
            2. Local Device Storage Queue (<code>localStorage</code> Sandbox):
          </label>
          {queue.length === 0 ? (
            <div className="sim-empty-queue">
              No check-ins currently queued on this device. Click <strong>"⚡ Populate 3 Synthetic Village Check-Ins"</strong> above or record a check-in while in offline mode.
            </div>
          ) : (
            <div className="sim-table-wrap">
              <table className="data-table sim-queue-table">
                <thead>
                  <tr>
                    <th>Queue ID</th>
                    <th>Patient</th>
                    <th>Cohort</th>
                    <th>Vitals & Symptoms</th>
                    <th>Queued At</th>
                    <th>Size</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td><code className="code-id">{item.id.slice(-10)}</code></td>
                      <td><strong>{item.pseudonym}</strong></td>
                      <td><span className={`cohort-tag ${item.cohort}`}>{item.cohort?.toUpperCase()}</span></td>
                      <td>
                        <span className="vitals-preview">
                          {item.payload.measurements?.systolic && (
                            <>BP: {item.payload.measurements.systolic}/{item.payload.measurements.diastolic} mmHg · </>
                          )}
                          {item.payload.measurements?.randomGlucose && (
                            <>Glucose: {item.payload.measurements.randomGlucose} mg/dL · </>
                          )}
                          {item.payload.symptoms?.length > 0
                            ? `Symptoms: ${item.payload.symptoms.join(', ')}`
                            : 'No acute symptoms'}
                        </span>
                      </td>
                      <td>{new Date(item.queuedAt).toLocaleTimeString()}</td>
                      <td><code>{item.bytes || 320} B</code></td>
                      <td>
                        <button
                          type="button"
                          className="btn-trash"
                          onClick={() => removeQueueItem(item.id)}
                          disabled={syncing}
                          title="Remove item from queue"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Animated Progress Bar */}
        {syncing && (
          <div className="sim-progress-box">
            <div className="sim-progress-header">
              <span>Synchronizing packets with PHC server...</span>
              <strong>{syncProgress}%</strong>
            </div>
            <div className="sim-progress-track">
              <div className="sim-progress-fill" style={{ width: `${syncProgress}%` }} />
            </div>
          </div>
        )}

        {/* Live Network & Rule Engine Telemetry Terminal */}
        <div className="sim-section">
          <label className="sim-section-label">3. Live Transport & Server Rule Engine Telemetry:</label>
          <div className="telemetry-terminal" ref={terminalRef}>
            <div className="terminal-header-bar">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <span className="terminal-title">swasthya-sense-transport-daemon · sequential-replay</span>
              <span className="terminal-clear" onClick={() => setTelemetryLogs([])}>Clear Log</span>
            </div>
            <div className="terminal-body">
              {telemetryLogs.length === 0 ? (
                <div className="terminal-placeholder">
                  [Idle] Ready for simulation. Click "▶ Run Animated Sync Simulation" to trace sequential packet uploads, latency throttling, rule engine evaluations, and MySQL audit logging.
                </div>
              ) : (
                telemetryLogs.map((log, index) => (
                  <div key={index} className="terminal-line">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={syncing}>
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
}

