/**
 * Sync Module
 * Orchestrates syncing of training sessions to the cloud
 */

import { saveSession, syncSessions } from './api/sessions';
import {
  updateSessionSyncStatus,
  getUnsyncedSessions,
  getFailedSyncSessions,
} from './db';
import type { TrainingSession } from '@/types';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ sessionId: string; error: string }>;
}

/**
 * Sync a single session to the cloud
 */
export async function syncSingleSession(session: TrainingSession): Promise<void> {
  try {
    // Mark as syncing
    await updateSessionSyncStatus(session.oderId, 'syncing');

    // Save to backend
    const response = await saveSession(session);

    // Mark as synced — SaveSessionResponse is ApiTrainingSession (unwrapped)
    await updateSessionSyncStatus(session.oderId, 'synced', {
      cloudId: response.id,
      syncedAt: response.created_at,
    });
  } catch (error) {
    // Mark as sync-failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSessionSyncStatus(session.oderId, 'sync-failed', {
      syncError: errorMessage,
    });
    throw error;
  }
}

/**
 * Bulk sync all local sessions to the cloud
 * Used on first login
 */
export async function bulkSyncLocalSessions(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Get all local-only sessions
    const localSessions = await getUnsyncedSessions();

    if (localSessions.length === 0) {
      return result;
    }

    // Mark all as syncing
    await Promise.all(
      localSessions.map((session) => updateSessionSyncStatus(session.oderId, 'syncing'))
    );

    // Bulk sync to backend
    const response = await syncSessions(localSessions);

    // Backend returns { synced, skipped } — both mean the session is on the server
    result.syncedCount = response.synced + response.skipped;
    result.failedCount = 0;

    // Mark all sent sessions as synced (idempotent — skipped = already existed)
    for (const session of localSessions) {
      try {
        await updateSessionSyncStatus(session.oderId, 'synced');
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    }

    return result;
  } catch (error) {
    // If bulk sync fails completely, mark all as failed
    const localSessions = await getUnsyncedSessions();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    for (const session of localSessions) {
      await updateSessionSyncStatus(session.oderId, 'sync-failed', {
        syncError: errorMessage,
      });
      result.errors.push({
        sessionId: session.oderId,
        error: errorMessage,
      });
    }

    result.success = false;
    result.failedCount = localSessions.length;
    return result;
  }
}

/**
 * Retry failed syncs
 * Called periodically in background
 */
export async function retryFailedSyncs(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const failedSessions = await getFailedSyncSessions();

    for (const session of failedSessions) {
      try {
        await syncSingleSession(session);
        result.syncedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          sessionId: session.oderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (result.failedCount > 0) {
      result.success = false;
    }

    return result;
  } catch (error) {
    result.success = false;
    return result;
  }
}
