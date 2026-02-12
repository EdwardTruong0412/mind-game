/**
 * Storage Utilities
 * Helper functions for managing token storage across memory, localStorage, and cookies
 */

import type { AuthTokens, TokenMetadata } from '@/types/auth';

const TOKEN_METADATA_KEY = 'auth_token_metadata';

/**
 * Token storage strategy:
 * - Access token: Memory only (passed as React state)
 * - Refresh token: httpOnly cookie (set by backend)
 * - Token metadata: localStorage (for refresh scheduling)
 */

// Token Metadata (localStorage)
export function saveTokenMetadata(metadata: TokenMetadata): void {
  try {
    localStorage.setItem(TOKEN_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to save token metadata:', error);
  }
}

export function getTokenMetadata(): TokenMetadata | null {
  try {
    const data = localStorage.getItem(TOKEN_METADATA_KEY);
    if (!data) return null;
    return JSON.parse(data) as TokenMetadata;
  } catch (error) {
    console.error('Failed to get token metadata:', error);
    return null;
  }
}

export function clearTokenMetadata(): void {
  try {
    localStorage.removeItem(TOKEN_METADATA_KEY);
  } catch (error) {
    console.error('Failed to clear token metadata:', error);
  }
}

// Token expiry checking
export function isTokenExpired(expiresAt: number): boolean {
  // Add 60 second buffer to refresh before actual expiry
  return Date.now() >= expiresAt - 60000;
}

export function shouldRefreshToken(expiresAt: number): boolean {
  // Refresh if token expires in less than 5 minutes
  return Date.now() >= expiresAt - 300000;
}

// Calculate expiry timestamp from expires_in (seconds)
export function calculateExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

// User ID storage (for offline mode)
const USER_ID_KEY = 'current_user_id';

export function saveCurrentUserId(userId: string): void {
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error('Failed to save user ID:', error);
  }
}

export function getCurrentUserId(): string {
  try {
    return localStorage.getItem(USER_ID_KEY) || 'local';
  } catch (error) {
    console.error('Failed to get user ID:', error);
    return 'local';
  }
}

export function clearCurrentUserId(): void {
  try {
    localStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.error('Failed to clear user ID:', error);
  }
}
