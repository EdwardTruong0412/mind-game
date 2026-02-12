/**
 * Users API
 * API functions for user profile and preferences
 */

import { getApiClient } from '@/lib/api-client';
import type {
  UserProfile,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
} from '@/types/api';

const API_PREFIX = '/api/v1';

/**
 * Get current user's profile
 */
export async function getUserProfile(): Promise<UserProfile> {
  const client = getApiClient();
  return client.get<UserProfile>(`${API_PREFIX}/users/me`);
}

/**
 * Update user profile (display name, avatar)
 */
export async function updateProfile(updates: UpdateProfileRequest): Promise<UserProfile> {
  const client = getApiClient();
  return client.patch<UserProfile>(`${API_PREFIX}/users/me`, updates);
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  preferences: UpdatePreferencesRequest
): Promise<UserProfile> {
  const client = getApiClient();
  return client.patch<UserProfile>(`${API_PREFIX}/users/me/preferences`, preferences);
}
