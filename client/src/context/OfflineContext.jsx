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
  const [syncStatus, setSyncStatus] = useState(null); // { message, type: 'success' | 'warning' | 'error' }

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('swasthya_offline_mode', isOffline ? 'true' : 'false');
  }, [isOffline]);

  useEffect(() => {
    localStorage.setItem('swasthya_offline_queue', JSON.stringify(queue));
  }, [queue]);

  // Listen to native browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      village_or_ward: patient.village_or_ward || 'Ward 3 (Sitapur)',
      payload,
      queuedAt: new Date().toISOString(),
    };

    setQueue((prev) => [...prev, queueItem]);
    return {
      success: true,
      offline: true,
      message: 'Check-in saved locally on frontline device.',
    };
  };

  /**
   * Clean, direct sync helper - uploads queued records to central database.
   */
  const syncQueue = async () => {
    if (queue.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    setSyncing(true);
    setSyncStatus(null);
    let syncedCount = 0;
    const errors = [];
    const remainingQueue = [];

    for (const item of queue) {
      try {
        await api.checkIns.record(item.patient_id, item.payload);
        syncedCount++;
      } catch (err) {
        console.error(`Failed to sync offline item for patient ${item.pseudonym}:`, err);
        errors.push(`${item.pseudonym}: ${err.message}`);
        remainingQueue.push(item);
      }
    }

    setQueue(remainingQueue);
    setSyncing(false);

    if (errors.length === 0) {
      setIsOffline(false);
      setSyncStatus({
        type: 'success',
        message: `✓ ${syncedCount} check-in(s) successfully synced with central health database!`,
      });
      return { success: true, syncedCount };
    } else {
      setSyncStatus({
        type: 'warning',
        message: `Synced ${syncedCount} item(s), ${errors.length} failed. Remaining in offline queue.`,
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
