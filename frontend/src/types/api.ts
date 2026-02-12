/**
 * API Types
 * Type definitions for API requests and responses
 */

import type { AuthUser, SyncStatus } from './auth';

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

// Auth API Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
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
  user_id: string;
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

// User API Types
export interface UserProfile extends AuthUser {
  created_at: string;
  preferences: UserPreferences;
  stats: UserStats;
}

export interface UserPreferences {
  grid_size: number;
  order_mode: 'sequential' | 'random';
  language: 'en' | 'vi';
  sound_enabled: boolean;
}

export interface UserStats {
  total_sessions: number;
  total_time: number;
  best_time: number | null;
  average_time: number | null;
  last_session_at: string | null;
}

export interface UpdateProfileRequest {
  display_name?: string;
  avatar_url?: string | null;
}

export interface UpdatePreferencesRequest {
  grid_size?: number;
  order_mode?: 'sequential' | 'random';
  language?: 'en' | 'vi';
  sound_enabled?: boolean;
}

// Session API Types
export interface ApiTrainingSession {
  id: string;
  user_id: string;
  client_session_id: string;
  grid_size: number;
  order_mode: 'sequential' | 'random';
  completion_time: number;
  is_completed: boolean;
  error_count: number;
  tap_events: TapEvent[];
  created_at: string;
}

export interface TapEvent {
  number: number;
  timestamp: number;
  x: number;
  y: number;
  is_correct: boolean;
}

export interface SaveSessionRequest {
  client_session_id: string;
  grid_size: number;
  order_mode: 'sequential' | 'random';
  completion_time: number;
  is_completed: boolean;
  error_count: number;
  tap_events: TapEvent[];
}

export interface SaveSessionResponse {
  session: ApiTrainingSession;
}

export interface SyncSessionsRequest {
  sessions: SaveSessionRequest[];
}

export interface SyncSessionsResponse {
  synced_count: number;
  failed_count: number;
  sessions: ApiTrainingSession[];
}

export interface ListSessionsResponse {
  sessions: ApiTrainingSession[];
  total: number;
}

// Leaderboard API Types
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  completion_time: number;
  grid_size: number;
  order_mode: 'sequential' | 'random';
  session_date: string;
  is_current_user?: boolean;
}

export interface DailyLeaderboardResponse {
  date: string;
  grid_size: number;
  order_mode: 'sequential' | 'random';
  entries: LeaderboardEntry[];
  current_user_rank: number | null;
}

export interface AllTimeLeaderboardResponse {
  grid_size: number;
  order_mode: 'sequential' | 'random';
  entries: LeaderboardEntry[];
  current_user_rank: number | null;
}
