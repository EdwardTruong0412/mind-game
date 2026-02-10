'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Play, History, Settings, Sun, Moon, Monitor, HelpCircle, Eye, Target, Clock, Trophy, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings, useTheme } from '@/hooks/use-settings';
import { useTranslation } from '@/hooks/use-language';
import { useGameStore } from '@/stores/game-store';
import { formatTimeShort } from '@/lib/game-logic';
import { cn } from '@/lib/utils';

// Grid size options: 4x4 to 10x10
const GRID_SIZES = [4, 5, 6, 7, 8, 9, 10];

export default function HomePage() {
  const router = useRouter();
  const { preferences, stats, isLoading, updateSetting } = useSettings();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const { initGame } = useGameStore();

  const [gridSize, setGridSize] = useState(5);
  const [maxTime, setMaxTime] = useState(120);
  const [orderMode, setOrderMode] = useState<'ASC' | 'DESC'>('ASC');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Sync with saved preferences
  useEffect(() => {
    if (!isLoading) {
      setGridSize(preferences.defaultGridSize);
      setMaxTime(preferences.defaultMaxTime);
    }
  }, [isLoading, preferences.defaultGridSize, preferences.defaultMaxTime]);

  // Show help for first-time visitors
  useEffect(() => {
    if (!isLoading && stats.totalSessions === 0) {
      const hasSeenHelp = localStorage.getItem('hasSeenHelp');
      if (!hasSeenHelp) {
        setShowHelp(true);
        localStorage.setItem('hasSeenHelp', 'true');
      }
    }
  }, [isLoading, stats.totalSessions]);

  const handleStart = () => {
    initGame(gridSize, maxTime, orderMode);
    router.push('/train');
  };

  const bestTimeKey = `${gridSize}-${orderMode}`;
  const bestTime = (stats.bestTimes as Record<string, number>)[bestTimeKey];

  // Grid size navigation
  const currentGridIndex = GRID_SIZES.indexOf(gridSize);
  const canGoSmaller = currentGridIndex > 0;
  const canGoLarger = currentGridIndex < GRID_SIZES.length - 1;

  const decreaseGridSize = () => {
    if (canGoSmaller) setGridSize(GRID_SIZES[currentGridIndex - 1]);
  };

  const increaseGridSize = () => {
    if (canGoLarger) setGridSize(GRID_SIZES[currentGridIndex + 1]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">{t('loading')}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{t('appName')}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHelp(true)}
            title={t('howToPlay')}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/history')}
            title={t('history')}
          >
            <History className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            title={t('settings')}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-8">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 w-full text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('sessions')}</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('streak')}</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {bestTime ? formatTimeShort(bestTime) : '--'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('best')}</div>
          </div>
        </div>

        {/* Game configuration */}
        <div className="w-full space-y-6 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          {/* Grid size with arrows */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('gridSize')}
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={decreaseGridSize}
                disabled={!canGoSmaller}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  canGoSmaller
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'opacity-30 cursor-not-allowed'
                )}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="text-center min-w-[100px]">
                <div className="text-3xl font-bold">{gridSize}×{gridSize}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {gridSize * gridSize} {language === 'vi' ? 'ô' : 'cells'}
                </div>
              </div>
              <button
                onClick={increaseGridSize}
                disabled={!canGoLarger}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  canGoLarger
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'opacity-30 cursor-not-allowed'
                )}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            {/* Difficulty indicator */}
            <div className="flex justify-center gap-1 mt-2">
              {GRID_SIZES.map((size, index) => (
                <div
                  key={size}
                  className={cn(
                    'h-1 w-4 rounded-full transition-all',
                    index <= currentGridIndex
                      ? index < 2
                        ? 'bg-green-500'
                        : index < 4
                        ? 'bg-yellow-500'
                        : index < 6
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              ))}
            </div>
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              {gridSize <= 5 ? (language === 'vi' ? 'Dễ' : 'Easy') :
               gridSize <= 6 ? (language === 'vi' ? 'Trung bình' : 'Medium') :
               gridSize <= 7 ? (language === 'vi' ? 'Khó' : 'Hard') :
               (language === 'vi' ? 'Siêu khó' : 'Extreme')}
            </div>
          </div>

          {/* Max time */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('timeLimit')}: {maxTime}s
            </label>
            <input
              type="range"
              min="30"
              max="600"
              step="10"
              value={maxTime}
              onChange={(e) => setMaxTime(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>30s</span>
              <span>10m</span>
            </div>
          </div>

          {/* Order mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('order')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderMode('ASC')}
                className={cn(
                  'flex-1 py-3 rounded-lg font-medium transition-all',
                  orderMode === 'ASC'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                1 → {gridSize * gridSize}
              </button>
              <button
                onClick={() => setOrderMode('DESC')}
                className={cn(
                  'flex-1 py-3 rounded-lg font-medium transition-all',
                  orderMode === 'DESC'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {gridSize * gridSize} → 1
              </button>
            </div>
          </div>
        </div>

        {/* Start button */}
        <Button size="xl" className="w-full" onClick={handleStart}>
          <Play className="w-5 h-5 mr-2" />
          {t('startTraining')}
        </Button>
      </div>

      {/* How to Play modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold">{t('howToPlay')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
                {t('close')}
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* What is Schulte Table */}
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">{t('whatIsSchulte')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('schulteDescription')}
                </p>
              </div>

              {/* How to play steps */}
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">{t('howToPlayTitle')}</h3>

                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium">{t('step1Title')}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('step1Desc')}</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium">{t('step2Title')}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('step2Desc')}</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium">{t('step3Title')}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('step3Desc')}</p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">{t('proTips')}</h3>

                <div className="flex gap-3 items-start">
                  <Eye className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{t('tip1')}</span> {t('tip1Desc')}
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <Target className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{t('tip2')}</span> {t('tip2Desc')}
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <Clock className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{t('tip3')}</span> {t('tip3Desc')}
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{t('tip4')}</span> {t('tip4Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button className="w-full" onClick={() => setShowHelp(false)}>
                {t('gotIt')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold">{t('settings')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                {t('close')}
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t('language')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('en')}
                    className={cn(
                      'flex-1 py-3 rounded-lg font-medium transition-all',
                      language === 'en'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    🇺🇸 English
                  </button>
                  <button
                    onClick={() => setLanguage('vi')}
                    className={cn(
                      'flex-1 py-3 rounded-lg font-medium transition-all',
                      language === 'vi'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    🇻🇳 Tiếng Việt
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('theme')}</label>
                <div className="flex gap-2">
                  {[
                    { value: 'light', icon: Sun, label: t('light') },
                    { value: 'dark', icon: Moon, label: t('dark') },
                    { value: 'system', icon: Monitor, label: t('system') },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-3 rounded-lg transition-all',
                        theme === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle settings */}
              {[
                { key: 'hapticFeedback', label: t('hapticFeedback'), desc: t('vibrateOnTap') },
                { key: 'showHints', label: t('showHints'), desc: t('highlightNext') },
                { key: 'showFixationDot', label: t('fixationDot'), desc: t('centerEyeAnchor') },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{desc}</div>
                  </div>
                  <button
                    onClick={() =>
                      updateSetting(
                        key as keyof typeof preferences,
                        !preferences[key as keyof typeof preferences]
                      )
                    }
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      preferences[key as keyof typeof preferences]
                        ? 'bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                        preferences[key as keyof typeof preferences]
                          ? 'translate-x-7'
                          : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Fixed Footer */}
            <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  updateSetting('defaultGridSize', gridSize);
                  updateSetting('defaultMaxTime', maxTime);
                  setShowSettings(false);
                }}
              >
                {t('saveDefault')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
