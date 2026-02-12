/**
 * Sync Store
 * Zustand store for managing sync queue and state
 */

import { create } from 'zustand';
import { syncSingleSession, bulkSyncLocalSessions, retryFailedSyncs } from '@/lib/sync';
import type { TrainingSession } from '@/types';
import type { SyncResult } from '@/lib/sync';

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncQueue: Set<string>; // Session IDs in queue
  syncErrors: Map<string, string>; // Session ID -> error message

  // Actions
  queueSession: (session: TrainingSession) => void;
  syncSession: (session: TrainingSession) => Promise<void>;
  bulkSync: () => Promise<SyncResult>;
  retryFailed: () => Promise<SyncResult>;
  clearError: (sessionId: string) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncAt: null,
  syncQueue: new Set(),
  syncErrors: new Map(),

  queueSession: (session) => {
    set((state) => ({
      syncQueue: new Set(state.syncQueue).add(session.oderId),
    }));
  },

  syncSession: async (session) => {
    const { syncQueue, syncErrors } = get();

    set({ isSyncing: true });

    try {
      await syncSingleSession(session);

      // Remove from queue and clear any errors
      const newQueue = new Set(syncQueue);
      newQueue.delete(session.oderId);

      const newErrors = new Map(syncErrors);
      newErrors.delete(session.oderId);

      set({
        syncQueue: newQueue,
        syncErrors: newErrors,
        lastSyncAt: Date.now(),
      });
    } catch (error) {
      // Add error
      const newErrors = new Map(syncErrors);
      newErrors.set(session.oderId, error instanceof Error ? error.message : 'Unknown error');

      set({ syncErrors: newErrors });
      throw error;
    } finally {
      set({ isSyncing: false });
    }
  },

  bulkSync: async () => {
    set({ isSyncing: true });

    try {
      const result = await bulkSyncLocalSessions();

      // Clear errors for successfully synced sessions
      if (result.syncedCount > 0) {
        set((state) => {
          const newErrors = new Map(state.syncErrors);
          // We don't have session IDs here, so we'll rely on sync status in DB
          return { syncErrors: newErrors };
        });
      }

      set({ lastSyncAt: Date.now() });
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  retryFailed: async () => {
    set({ isSyncing: true });

    try {
      const result = await retryFailedSyncs();

      // Update errors based on retry results
      set((state) => {
        const newErrors = new Map(state.syncErrors);

        // Clear errors for successfully synced sessions
        result.errors.forEach((error) => {
          newErrors.set(error.sessionId, error.error);
        });

        return { syncErrors: newErrors };
      });

      if (result.syncedCount > 0) {
        set({ lastSyncAt: Date.now() });
      }

      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  clearError: (sessionId) => {
    set((state) => {
      const newErrors = new Map(state.syncErrors);
      newErrors.delete(sessionId);
      return { syncErrors: newErrors };
    });
  },
}));
