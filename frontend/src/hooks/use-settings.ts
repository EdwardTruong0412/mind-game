'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreateProfile, updatePreferences, defaultPreferences, defaultStats } from '@/lib/db';
import type { UserPreferences } from '@/types';

export function useSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

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
      await updatePreferences({ [key]: value });
    },
    []
  );

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
