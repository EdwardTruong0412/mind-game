/**
 * Leaderboards API
 * API functions for leaderboard data
 */

import { getApiClient } from '@/lib/api-client';
import type {
  DailyLeaderboardResponse,
  AllTimeLeaderboardResponse,
} from '@/types/api';

const API_PREFIX = '/api/v1';

/**
 * Convert frontend orderMode ('ASC'|'DESC') to backend format
 */
function toApiOrderMode(orderMode: 'ASC' | 'DESC'): string {
  return orderMode;
}

/**
 * Get daily leaderboard for a specific date and configuration
 */
export async function getDailyLeaderboard(params: {
  date?: string;
  gridSize: number;
  orderMode: 'ASC' | 'DESC';
}): Promise<DailyLeaderboardResponse> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    grid_size: params.gridSize.toString(),
    order_mode: toApiOrderMode(params.orderMode),
    ...(params.date && { date: params.date }),
  });

  return client.get<DailyLeaderboardResponse>(
    `${API_PREFIX}/leaderboards/daily?${queryParams}`
  );
}

/**
 * Get all-time leaderboard for a specific configuration
 */
export async function getAllTimeLeaderboard(params: {
  gridSize: number;
  orderMode: 'ASC' | 'DESC';
  limit?: number;
}): Promise<AllTimeLeaderboardResponse> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    grid_size: params.gridSize.toString(),
    order_mode: toApiOrderMode(params.orderMode),
    ...(params.limit && { limit: params.limit.toString() }),
  });

  return client.get<AllTimeLeaderboardResponse>(
    `${API_PREFIX}/leaderboards/all-time?${queryParams}`
  );
}
