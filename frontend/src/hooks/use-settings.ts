'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreateProfile, updatePreferences, defaultPreferences, defaultStats } from '@/lib/db';
import { updatePreferences as updatePreferencesApi } from '@/lib/api/users';
import { getCurrentUserId } from '@/lib/storage';
import type { UserPreferences } from '@/types';

export function useSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize profile on mount (write operation - outside liveQuery)
  useEffect(() => {
    const init = async () => {
      await getOrCreateProfile();
      setInitialized(true);
      setIsLoading(false);
    };
    init();
  }, []);

  // Live query for profile (read-only)
  const profile = useLiveQuery(
    () => initialized ? db.profile.get('local') : undefined,
    [initialized]
  );

  const preferences = profile?.preferences ?? defaultPreferences;
  const stats = profile?.stats ?? defaultStats;

  const updateSetting = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      // Update local storage immediately
      await updatePreferences({ [key]: value });

      // Debounce sync to backend
      const userId = getCurrentUserId();
      if (userId !== 'local') {
        // Clear existing timeout
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        // Schedule sync after 500ms
        syncTimeoutRef.current = setTimeout(async () => {
          try {
            // Map frontend preference keys to backend format
            const backendKey = key === 'defaultGridSize' ? 'grid_size' :
                               key === 'defaultMaxTime' ? null : // Not synced to backend
                               key === 'showHints' ? null : // Not synced to backend
                               key === 'showFixationDot' ? null : // Not synced to backend
                               key === 'hapticFeedback' ? null : // Not synced to backend
                               key === 'soundEffects' ? 'sound_enabled' :
                               null;

            if (backendKey) {
              await updatePreferencesApi({ [backendKey]: value });
            }
          } catch (error) {
            console.error('Failed to sync preference to backend:', error);
            // Non-blocking - local preferences are already saved
          }
        }, 500);
      }
    },
    []
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    preferences,
    stats,
    isLoading,
    updateSetting,
  };
}

export function useTheme() {
  const { preferences, updateSetting } = useSettings();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const updateTheme = () => {
      let theme: 'light' | 'dark';

      if (preferences.theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        theme = preferences.theme;
      }

      setResolvedTheme(theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    };

    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [preferences.theme]);

  const setTheme = useCallback(
    (theme: 'light' | 'dark' | 'system') => {
      updateSetting('theme', theme);
    },
    [updateSetting]
  );

  return { theme: preferences.theme, resolvedTheme, setTheme };
}
