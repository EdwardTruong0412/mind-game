/**
 * Auth Types
 * Type definitions for authentication and user management
 */

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface TokenMetadata {
  expiresAt: number;
  lastRefreshed: number;
}

export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'sync-failed';

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AuthUser, 'display_name' | 'avatar_url'>>) => Promise<void>;
}
