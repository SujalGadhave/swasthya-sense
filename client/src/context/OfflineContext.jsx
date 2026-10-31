import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/api.js';

const OfflineContext = createContext();

export function OfflineProvider({ children }) {
  const [isOffline, setIsOffline] = useState(() => {
    return localStorage.getItem('swasthya_offline_mode') === 'true';
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
  const [syncStatus, setSyncStatus] = useState(null); // { message, type: 'success' | 'error' }

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('swasthya_offline_mode', isOffline ? 'true' : 'false');
  }, [isOffline]);

  useEffect(() => {
    localStorage.setItem('swasthya_offline_queue', JSON.stringify(queue));
  }, [queue]);

  const toggleOffline = () => {
    setIsOffline((prev) => !prev);
    setSyncStatus(null);
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
      village_or_ward: patient.village_or_ward,
      payload,
      queuedAt: new Date().toISOString(),
    };

    setQueue((prev) => [...prev, queueItem]);
    return {
      success: true,
      offline: true,
      message: 'Check-in saved offline on frontline device.',
    };
  };

  /**
   * Replay and synchronize queued check-ins to the backend.
   */
  const syncQueue = async () => {
    if (queue.length === 0) return { syncedCount: 0 };

    setSyncing(true);
    setSyncStatus(null);

    let syncedCount = 0;
    const remainingQueue = [...queue];
    const errors = [];

    // Temporarily ensure we make calls to the server even if user hasn't toggled switch yet
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        await api.checkins.submit({
          ...item.payload,
          is_offline_sync: true,
          offline_queued_at: item.queuedAt,
        });
        syncedCount++;
        // Remove item from remaining
        const idx = remainingQueue.findIndex((q) => q.id === item.id);
        if (idx !== -1) {
          remainingQueue.splice(idx, 1);
        }
      } catch (err) {
        console.error(`Failed to sync offline item for patient ${item.pseudonym}:`, err);
        errors.push(`${item.pseudonym}: ${err.message}`);
      }
    }

    setQueue(remainingQueue);
    setSyncing(false);

    if (errors.length === 0) {
      setSyncStatus({
        type: 'success',
        message: `Successfully synchronized ${syncedCount} check-in(s) to PHC server with audit trail!`,
      });
      // Automatically switch back to online if all synced
      setIsOffline(false);
      return { success: true, syncedCount };
    } else {
      setSyncStatus({
        type: 'warning',
        message: `Synced ${syncedCount} item(s), ${errors.length} failed. Remaining in queue.`,
      });
      return { success: false, syncedCount, errors };
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setSyncStatus(null);
  };

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        toggleOffline,
        queue,
        queueCount: queue.length,
        queueCheckIn,
        syncQueue,
        clearQueue,
        syncing,
        syncStatus,
        clearSyncStatus: () => setSyncStatus(null),
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
