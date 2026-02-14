/**
 * API Types
 * Type definitions matching the backend schemas exactly
 */

import type { AuthUser } from './auth';

// Generic API Response
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface RegisterResponse {
  message: string;
}

export interface ConfirmEmailRequest {
  email: string;
  confirmation_code: string;
}

export interface ConfirmEmailResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  confirmation_code: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  id_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserPreferences {
  theme: string;
  hapticFeedback: boolean;
  soundEffects: boolean;
  showHints: boolean;
  showFixationDot: boolean;
  defaultGridSize: number;
  defaultMaxTime: number;
}

export interface UserStats {
  totalSessions: number;
  completedSessions: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: string | null;
  bestTimes: Record<string, number>;
  avgTimes: Record<string, number>;
}

export interface UserProfile extends AuthUser {
  created_at: string;
  preferences: UserPreferences;
  stats: UserStats;
}

export interface UpdateProfileRequest {
  display_name?: string;
  avatar_url?: string | null;
}

export interface UpdatePreferencesRequest {
  theme?: string;
  hapticFeedback?: boolean;
  soundEffects?: boolean;
  showHints?: boolean;
  showFixationDot?: boolean;
  defaultGridSize?: number;
  defaultMaxTime?: number;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// TapEvent format the backend expects
export interface ApiTapEvent {
  cellIndex: number;
  expectedValue: number;
  tappedValue: number;
  correct: boolean;
  timestampMs: number;
}

export interface SaveSessionRequest {
  client_session_id: string;
  grid_size: number;
  max_time: number;
  order_mode: 'ASC' | 'DESC';
  status: 'completed' | 'timeout' | 'abandoned';
  completion_time_ms: number | null;
  mistakes: number;
  accuracy: number;
  tap_events: ApiTapEvent[];
  started_at: string;
  completed_at: string | null;
}

// Backend returns the session object directly (not wrapped)
export interface ApiTrainingSession {
  id: string;
  user_id: string;
  client_session_id: string;
  grid_size: number;
  max_time: number;
  order_mode: string;
  status: string;
  completion_time_ms: number | null;
  mistakes: number;
  accuracy: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export type SaveSessionResponse = ApiTrainingSession;

export interface SyncSessionsRequest {
  sessions: SaveSessionRequest[];
}

export interface SyncSessionsResponse {
  synced: number;
  skipped: number;
}

export interface ListSessionsResponse {
  data: ApiTrainingSession[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// ─── Leaderboards ────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string | null;
  best_time_ms: number;
  date: string;
}

export interface LeaderboardMeta {
  grid_size: number;
  order_mode: string;
  date?: string;
  total_entries: number;
}

export interface CurrentUserRank {
  rank: number;
  best_time_ms: number;
}

export interface DailyLeaderboardResponse {
  data: LeaderboardEntry[];
  meta: LeaderboardMeta;
  current_user: CurrentUserRank | null;
}

export interface AllTimeLeaderboardResponse {
  data: LeaderboardEntry[];
  meta: LeaderboardMeta;
  current_user: CurrentUserRank | null;
}
