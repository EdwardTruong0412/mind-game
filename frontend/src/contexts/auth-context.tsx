'use client';

/**
 * Auth Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { initializeApiClient } from '@/lib/api-client';
import * as authApi from '@/lib/api/auth';
import * as usersApi from '@/lib/api/users';
import {
  saveTokenMetadata,
  getTokenMetadata,
  clearTokenMetadata,
  saveCurrentUserId,
  getCurrentUserId,
  clearCurrentUserId,
  calculateExpiresAt,
  shouldRefreshToken,
} from '@/lib/storage';
import { bulkSyncLocalSessions } from '@/lib/sync';
import { useToast } from '@/components/ui/toast/toast-provider';
import type { AuthContextValue, AuthUser, AuthTokens } from '@/types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize API client
  useEffect(() => {
    initializeApiClient({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      getAccessToken: () => tokens?.accessToken || null,
      onTokenRefresh: async () => {
        await handleRefreshTokens();
      },
      onUnauthorized: () => {
        handleLogout();
      },
    });
  }, [tokens]);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Auto-refresh token when needed
  useEffect(() => {
    if (!tokens) return;

    const checkTokenExpiry = () => {
      if (shouldRefreshToken(tokens.expiresAt)) {
        handleRefreshTokens();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);
    return () => clearInterval(interval);
  }, [tokens]);

  const restoreSession = async () => {
    setIsLoading(true);
    try {
      const metadata = getTokenMetadata();
      const userId = getCurrentUserId();

      if (metadata && userId !== 'local') {
        // Try to refresh token to restore session
        await handleRefreshTokens();
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Clear invalid session
      clearTokenMetadata();
      clearCurrentUserId();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshTokens = async () => {
    try {
      const response = await authApi.refreshAccessToken();

      const newTokens: AuthTokens = {
        accessToken: response.access_token,
        idToken: response.id_token,
        refreshToken: '', // Refresh token is in httpOnly cookie, not needed in memory
        expiresAt: calculateExpiresAt(response.expires_in),
      };

      setTokens(newTokens);
      saveTokenMetadata({
        expiresAt: newTokens.expiresAt,
        lastRefreshed: Date.now(),
      });

      // Fetch updated user profile if we have tokens but no user
      if (!user) {
        try {
          const profile = await usersApi.getUserProfile();
          setUser({
            id: profile.id,
            email: profile.email,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          });
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);

      const newTokens: AuthTokens = {
        accessToken: response.access_token,
        idToken: response.id_token,
        refreshToken: response.refresh_token,
        expiresAt: calculateExpiresAt(response.expires_in),
      };

      setTokens(newTokens);
      setUser(response.user);

      saveTokenMetadata({
        expiresAt: newTokens.expiresAt,
        lastRefreshed: Date.now(),
      });
      saveCurrentUserId(response.user.id);

      // Trigger bulk sync of local sessions in background
      bulkSyncLocalSessions().catch((error) => {
        console.error('Background bulk sync failed:', error);
        // Non-blocking, will retry via useSync hook
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    try {
      await authApi.register(email, password, displayName);
      // After registration, user needs to confirm email before logging in
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      setTokens(null);
      setUser(null);
      clearTokenMetadata();
      clearCurrentUserId();
    }
  };

  const handleConfirmEmail = async (email: string, code: string) => {
    try {
      await authApi.confirmEmail(email, code);
    } catch (error) {
      console.error('Email confirmation failed:', error);
      throw error;
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      await authApi.forgotPassword(email);
    } catch (error) {
      console.error('Forgot password failed:', error);
      throw error;
    }
  };

  const handleResetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await authApi.resetPassword(email, code, newPassword);
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  const handleUpdateProfile = async (
    updates: Partial<Pick<AuthUser, 'display_name' | 'avatar_url'>>
  ) => {
    try {
      const updatedProfile = await usersApi.updateProfile(updates);

      // Update local user state
      setUser({
        id: updatedProfile.id,
        email: updatedProfile.email,
        display_name: updatedProfile.display_name,
        avatar_url: updatedProfile.avatar_url,
      });
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const value: AuthContextValue = {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    confirmEmail: handleConfirmEmail,
    forgotPassword: handleForgotPassword,
    resetPassword: handleResetPassword,
    refreshTokens: handleRefreshTokens,
    updateProfile: handleUpdateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
