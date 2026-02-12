/**
 * Sync Module
 * Orchestrates syncing of training sessions to the cloud
 */

import { saveSession, syncSessions } from './api/sessions';
import { db } from './db';
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
    await db.updateSessionSyncStatus(session.oderId, 'syncing');

    // Save to backend
    const response = await saveSession(session);

    // Mark as synced
    await db.updateSessionSyncStatus(session.oderId, 'synced', {
      cloudId: response.session.id,
      syncedAt: response.session.created_at,
    });
  } catch (error) {
    // Mark as sync-failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await db.updateSessionSyncStatus(session.oderId, 'sync-failed', {
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
    const localSessions = await db.getUnsyncedSessions();

    if (localSessions.length === 0) {
      return result;
    }

    // Mark all as syncing
    await Promise.all(
      localSessions.map((session) => db.updateSessionSyncStatus(session.oderId, 'syncing'))
    );

    // Bulk sync to backend
    const response = await syncSessions(localSessions);

    result.syncedCount = response.synced_count;
    result.failedCount = response.failed_count;

    // Update sync status for successfully synced sessions
    for (const cloudSession of response.sessions) {
      try {
        await db.updateSessionSyncStatus(cloudSession.client_session_id, 'synced', {
          cloudId: cloudSession.id,
          syncedAt: cloudSession.created_at,
        });
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    }

    // Mark failed sessions
    if (result.failedCount > 0) {
      result.success = false;
      // Note: Backend doesn't return which sessions failed,
      // so we mark syncing sessions that weren't returned as failed
      const syncedIds = new Set(response.sessions.map((s) => s.client_session_id));
      const failedSessions = localSessions.filter((s) => !syncedIds.has(s.oderId));

      for (const session of failedSessions) {
        await db.updateSessionSyncStatus(session.oderId, 'sync-failed', {
          syncError: 'Sync failed on server',
        });
        result.errors.push({
          sessionId: session.oderId,
          error: 'Sync failed on server',
        });
      }
    }

    return result;
  } catch (error) {
    // If bulk sync fails completely, mark all as failed
    const localSessions = await db.getUnsyncedSessions();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    for (const session of localSessions) {
      await db.updateSessionSyncStatus(session.oderId, 'sync-failed', {
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
    const failedSessions = await db.getFailedSyncSessions();

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
