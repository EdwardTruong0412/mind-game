/**
 * Auth API
 * API functions for authentication operations
 */

import { getApiClient } from '@/lib/api-client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ConfirmEmailRequest,
  ConfirmEmailResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  RefreshTokenResponse,
} from '@/types/api';

const API_PREFIX = '/api/v1';

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const client = getApiClient();
  const payload: LoginRequest = { email, password };

  return client.post<LoginResponse>(`${API_PREFIX}/auth/login`, payload);
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<RegisterResponse> {
  const client = getApiClient();
  const payload: RegisterRequest = {
    email,
    password,
    display_name: displayName,
  };

  return client.post<RegisterResponse>(`${API_PREFIX}/auth/register`, payload);
}

/**
 * Confirm email with verification code
 */
export async function confirmEmail(email: string, code: string): Promise<ConfirmEmailResponse> {
  const client = getApiClient();
  const payload: ConfirmEmailRequest = {
    email,
    confirmation_code: code,
  };

  return client.post<ConfirmEmailResponse>(`${API_PREFIX}/auth/confirm`, payload);
}

/**
 * Request password reset code
 */
export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const client = getApiClient();
  const payload: ForgotPasswordRequest = { email };

  return client.post<ForgotPasswordResponse>(`${API_PREFIX}/auth/forgot-password`, payload);
}

/**
 * Reset password with verification code
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  const client = getApiClient();
  const payload: ResetPasswordRequest = {
    email,
    confirmation_code: code,
    new_password: newPassword,
  };

  return client.post<ResetPasswordResponse>(`${API_PREFIX}/auth/reset-password`, payload);
}

/**
 * Refresh access token using refresh token from httpOnly cookie
 */
export async function refreshAccessToken(): Promise<RefreshTokenResponse> {
  const client = getApiClient();

  // Refresh token is sent automatically via httpOnly cookie
  // No need to include it in the request body
  return client.post<RefreshTokenResponse>(`${API_PREFIX}/auth/refresh`, {});
}

/**
 * Logout (clear tokens)
 */
export async function logout(): Promise<void> {
  const client = getApiClient();

  // Backend will clear the httpOnly cookie
  await client.post<void>(`${API_PREFIX}/auth/logout`, {});
}
