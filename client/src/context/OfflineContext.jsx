import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/api.js';

const OfflineContext = createContext();

export function OfflineProvider({ children }) {
  const [networkProfile, setNetworkProfile] = useState(() => {
    return localStorage.getItem('swasthya_network_profile') || 'online_4g';
  });

  const [isOffline, setIsOffline] = useState(() => {
    return localStorage.getItem('swasthya_offline_mode') === 'true' || networkProfile === 'offline_zero';
  });

  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('swasthya_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { message, type: 'success' | 'warning' | 'error' }
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('swasthya_offline_mode', isOffline ? 'true' : 'false');
    localStorage.setItem('swasthya_network_profile', networkProfile);
  }, [isOffline, networkProfile]);

  useEffect(() => {
    localStorage.setItem('swasthya_offline_queue', JSON.stringify(queue));
  }, [queue]);

  const toggleOffline = () => {
    setIsOffline((prev) => {
      const next = !prev;
      setNetworkProfile(next ? 'offline_zero' : 'online_4g');
      return next;
    });
    setSyncStatus(null);
  };

  const changeNetworkProfile = (profile) => {
    setNetworkProfile(profile);
    if (profile === 'offline_zero') {
      setIsOffline(true);
    } else {
      setIsOffline(false);
    }
  };

  /**
   * Queue a check-in locally when offline.
   */
  const queueCheckIn = (patient, payload) => {
    const queueItem = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      patient_id: patient.id || patient.patient_id,
      pseudonym: patient.pseudonym,
      cohort: patient.cohort,
      village_or_ward: patient.village_or_ward || 'Ward 3 (Sitapur)',
      payload,
      queuedAt: new Date().toISOString(),
      bytes: new Blob([JSON.stringify(payload)]).size,
    };

    setQueue((prev) => [...prev, queueItem]);
    return {
      success: true,
      offline: true,
      message: 'Check-in saved offline on frontline device.',
    };
  };

  /**
   * 1-Click Generator: Populates 3 realistic synthetic village check-ins for demoing
   */
  const populateSyntheticBatch = (availablePatients = []) => {
    const fallbackPatients = [
      { id: 'patient-anc-01', pseudonym: 'Priya Sharma', cohort: 'antenatal', village_or_ward: 'Ward 3 (Sitapur)' },
      { id: 'patient-htn-01', pseudonym: 'Rajesh Verma', cohort: 'hypertension', village_or_ward: 'Ward 3 (Sitapur)' },
      { id: 'patient-dia-01', pseudonym: 'Amit Kumar', cohort: 'diabetes', village_or_ward: 'Ward 3 (Sitapur)' },
    ];

    const source = availablePatients.length >= 3 ? availablePatients : fallbackPatients;

    const p1 = source.find((p) => p.cohort === 'antenatal') || source[0];
    const p2 = source.find((p) => p.cohort === 'hypertension') || source[1] || source[0];
    const p3 = source.find((p) => p.cohort === 'diabetes') || source[2] || source[0];

    const sample1 = {
      id: `offline-anc-${Date.now()}`,
      patient_id: p1.id || p1.patient_id,
      pseudonym: p1.pseudonym,
      cohort: p1.cohort,
      village_or_ward: p1.village_or_ward || 'Ward 3',
      queuedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      payload: {
        patient_id: p1.id || p1.patient_id,
        channel: 'in_person',
        measurements: { systolic: 144, diastolic: 92, weightKg: 58 },
        symptoms: ['severe_headache_visual_changes'],
        notes: 'Recorded in remote village. Mother complained of blurred vision and acute headache.',
      },
    };
    sample1.bytes = new Blob([JSON.stringify(sample1.payload)]).size;

    const sample2 = {
      id: `offline-htn-${Date.now()}`,
      patient_id: p2.id || p2.patient_id,
      pseudonym: p2.pseudonym,
      cohort: p2.cohort,
      village_or_ward: p2.village_or_ward || 'Ward 3',
      queuedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      payload: {
        patient_id: p2.id || p2.patient_id,
        channel: 'in_person',
        measurements: { systolic: 162, diastolic: 102, heartRate: 86 },
        symptoms: ['shortness_of_breath'],
        notes: 'Doorstep follow-up in hilly terrain. High blood pressure verified with manual cuff.',
      },
    };
    sample2.bytes = new Blob([JSON.stringify(sample2.payload)]).size;

    const sample3 = {
      id: `offline-dia-${Date.now()}`,
      patient_id: p3.id || p3.patient_id,
      pseudonym: p3.pseudonym,
      cohort: p3.cohort,
      village_or_ward: p3.village_or_ward || 'Ward 3',
      queuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      payload: {
        patient_id: p3.id || p3.patient_id,
        channel: 'in_person',
        measurements: { randomGlucose: 215, weightKg: 63 },
        symptoms: [],
        notes: 'Routine doorstep check-in. Glucometer postprandial reading taken.',
      },
    };
    sample3.bytes = new Blob([JSON.stringify(sample3.payload)]).size;

    setQueue((prev) => [...prev, sample1, sample2, sample3]);
    setSyncStatus({
      type: 'warning',
      message: 'Generated 3 synthetic rural offline check-ins in device queue ready for sync simulation!',
    });
  };

  /**
   * Replay and synchronize queued check-ins to the backend with interactive telemetry.
   */
  const replaySyncWithSimulation = async (onTelemetryStep) => {
    if (queue.length === 0) return { syncedCount: 0 };

    setSyncing(true);
    setSyncStatus(null);

    const isThrottled = networkProfile === 'rural_2g';
    const isFlaky = networkProfile === 'flaky_tower';
    const stepDelay = isThrottled ? 900 : 250;

    let syncedCount = 0;
    const remainingQueue = [...queue];
    const errors = [];

    if (onTelemetryStep) {
      onTelemetryStep({
        phase: 'init',
        message: `[00:00.000] 📡 Opening socket to PHC server. Profile: ${networkProfile.toUpperCase()} (Sequential low-bandwidth batch)...`,
        percent: 5,
      });
    }

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const packetNum = i + 1;
      const totalPackets = queue.length;

      // Simulated network transport latency
      if (stepDelay > 0) {
        await new Promise((r) => setTimeout(r, stepDelay));
      }

      if (onTelemetryStep) {
        onTelemetryStep({
          phase: 'transmitting',
          message: `[Packet ${packetNum}/${totalPackets}] 📦 Transmitting payload (${item.bytes || 320} B) for ${item.pseudonym} (${item.cohort?.toUpperCase()})...`,
          percent: Math.round(((i + 0.5) / totalPackets) * 90),
        });
      }

      try {
        // If flaky network, simulate occasional retry
        if (isFlaky && i === 1) {
          if (onTelemetryStep) {
            onTelemetryStep({
              phase: 'retry',
              message: `[Packet ${packetNum}/${totalPackets}] ⚠️ Flaky connection packet timeout! Retrying with exponential backoff...`,
              percent: Math.round(((i + 0.7) / totalPackets) * 90),
            });
          }
          await new Promise((r) => setTimeout(r, 600));
        }

        const res = await api.checkins.submit({
          ...item.payload,
          is_offline_sync: true,
          offline_queued_at: item.queuedAt,
        });

        syncedCount++;

        if (onTelemetryStep) {
          const flagIds = res.flags && res.flags.length > 0 ? res.flags.map((f) => f.rule_id).join(', ') : 'None';
          onTelemetryStep({
            phase: 'ack',
            message: `[Packet ${packetNum}/${totalPackets}] ✅ ACK Received [HTTP 201]. Rule Engine evaluated: [${flagIds}]. Next visit: ${res.nextDueDate}`,
            percent: Math.round(((i + 1) / totalPackets) * 90),
          });
        }

        // Remove from remaining queue
        const idx = remainingQueue.findIndex((q) => q.id === item.id);
        if (idx !== -1) {
          remainingQueue.splice(idx, 1);
        }
      } catch (err) {
        console.error(`Failed to sync offline item for patient ${item.pseudonym}:`, err);
        errors.push(`${item.pseudonym}: ${err.message}`);
        if (onTelemetryStep) {
          onTelemetryStep({
            phase: 'error',
            message: `[Packet ${packetNum}/${totalPackets}] ❌ Transport error for ${item.pseudonym}: ${err.message}`,
            percent: Math.round(((i + 1) / totalPackets) * 90),
          });
        }
      }
    }

    setQueue(remainingQueue);
    setSyncing(false);

    if (errors.length === 0) {
      if (onTelemetryStep) {
        onTelemetryStep({
          phase: 'complete',
          message: `[Done] 🛡️ All ${syncedCount} packet(s) synchronized. MySQL audit trail committed with action CHECKIN_OFFLINE_SYNCED.`,
          percent: 100,
        });
      }
      setSyncStatus({
        type: 'success',
        message: `Successfully synchronized ${syncedCount} check-in(s) to PHC server with audit trail!`,
      });
      setIsOffline(false);
      setNetworkProfile('online_4g');
      return { success: true, syncedCount };
    } else {
      setSyncStatus({
        type: 'warning',
        message: `Synced ${syncedCount} item(s), ${errors.length} failed. Remaining in queue.`,
      });
      return { success: false, syncedCount, errors };
    }
  };

  /**
   * Standard sync helper
   */
  const syncQueue = async () => {
    return replaySyncWithSimulation(null);
  };

  const clearQueue = () => {
    setQueue([]);
    setSyncStatus(null);
  };

  const removeQueueItem = (id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        toggleOffline,
        networkProfile,
        changeNetworkProfile,
        queue,
        queueCount: queue.length,
        queueCheckIn,
        syncQueue,
        replaySyncWithSimulation,
        populateSyntheticBatch,
        clearQueue,
        removeQueueItem,
        syncing,
        syncStatus,
        clearSyncStatus: () => setSyncStatus(null),
        isSimulatorOpen,
        openSimulator: () => setIsSimulatorOpen(true),
        closeSimulator: () => setIsSimulatorOpen(false),
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
