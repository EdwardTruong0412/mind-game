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
 * Convert local TrainingSession to API SaveSessionRequest format
 */
function toApiSessionFormat(session: TrainingSession): SaveSessionRequest {
  return {
    client_session_id: session.oderId,
    grid_size: session.gridSize,
    order_mode: session.orderMode === 'ASC' ? 'sequential' : 'random',
    completion_time: session.completionTimeMs / 1000, // Convert ms to seconds
    is_completed: session.status === 'completed',
    error_count: session.mistakes,
    tap_events: session.tapEvents.map((event) => ({
      number: event.expectedValue,
      timestamp: event.timestampMs / 1000, // Convert ms to seconds
      x: 0, // We don't track coordinates in current implementation
      y: 0,
      is_correct: event.correct,
    })),
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
