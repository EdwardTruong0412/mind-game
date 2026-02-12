/**
 * useSync Hook
 * Hook for accessing sync state and triggering syncs
 */

import { useEffect } from 'react';
import { useSyncStore } from '@/stores/sync-store';
import { useAuth } from './use-auth';

export function useSync() {
  const { isAuthenticated } = useAuth();
  const {
    isSyncing,
    lastSyncAt,
    syncQueue,
    syncErrors,
    queueSession,
    syncSession,
    bulkSync,
    retryFailed,
    clearError,
  } = useSyncStore();

  // Auto-retry failed syncs every 60 seconds when online and authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(
      async () => {
        if (!isSyncing && navigator.onLine) {
          try {
            await retryFailed();
          } catch (error) {
            console.error('Auto-retry failed:', error);
          }
        }
      },
      60000
    ); // 60 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, isSyncing, retryFailed]);

  return {
    isSyncing,
    lastSyncAt,
    syncQueue,
    syncErrors,
    queueSession,
    syncSession,
    bulkSync,
    retryFailed,
    clearError,
    canSync: isAuthenticated && navigator.onLine,
  };
}
