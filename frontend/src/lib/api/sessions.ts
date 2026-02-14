/**
 * Sessions API
 * API functions for training session operations
 */

import { getApiClient } from '@/lib/api-client';
import type {
  SaveSessionRequest,
  SaveSessionResponse,
  SyncSessionsRequest,
  SyncSessionsResponse,
  ListSessionsResponse,
} from '@/types/api';
import type { TrainingSession } from '@/types';

const API_PREFIX = '/api/v1';

/**
 * Convert local TrainingSession to backend SessionCreate format
 */
function toApiSessionFormat(session: TrainingSession): SaveSessionRequest {
  return {
    client_session_id: session.oderId,
    grid_size: session.gridSize,
    max_time: session.maxTime,
    order_mode: session.orderMode, // Already 'ASC' | 'DESC' in local state
    status: session.status as 'completed' | 'timeout' | 'abandoned',
    completion_time_ms: session.completionTimeMs,
    mistakes: session.mistakes,
    accuracy: session.accuracy,
    tap_events: session.tapEvents.map((event) => ({
      cellIndex: event.cellIndex,
      expectedValue: event.expectedValue,
      tappedValue: event.tappedValue,
      correct: event.correct,
      timestampMs: event.timestampMs,
    })),
    started_at: session.startedAt,
    completed_at: session.completedAt,
  };
}

/**
 * Save a single training session to the backend
 */
export async function saveSession(session: TrainingSession): Promise<SaveSessionResponse> {
  const client = getApiClient();
  const payload = toApiSessionFormat(session);
  return client.post<SaveSessionResponse>(`${API_PREFIX}/sessions`, payload);
}

/**
 * Bulk sync multiple sessions to the backend
 * Used on first login to upload all local sessions
 */
export async function syncSessions(sessions: TrainingSession[]): Promise<SyncSessionsResponse> {
  const client = getApiClient();
  const payload: SyncSessionsRequest = {
    sessions: sessions.map(toApiSessionFormat),
  };
  return client.post<SyncSessionsResponse>(`${API_PREFIX}/sessions/sync`, payload);
}

/**
 * List all sessions for the current user
 */
export async function listSessions(): Promise<ListSessionsResponse> {
  const client = getApiClient();
  return client.get<ListSessionsResponse>(`${API_PREFIX}/sessions`);
}
