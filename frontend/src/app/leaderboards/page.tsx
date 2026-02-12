'use client';

/**
 * Leaderboards Page
 * Display daily and all-time leaderboards with filtering
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeaderboardTable } from '@/components/leaderboards/leaderboard-table';
import { LeaderboardFilters } from '@/components/leaderboards/leaderboard-filters';
import { getDailyLeaderboard, getAllTimeLeaderboard } from '@/lib/api/leaderboards';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/api';

type LeaderboardType = 'daily' | 'all-time';

export default function LeaderboardsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('daily');
  const [gridSize, setGridSize] = useState(5);
  const [orderMode, setOrderMode] = useState<'sequential' | 'random'>('sequential');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    fetchLeaderboard();
  }, [isAuthenticated, leaderboardType, gridSize, orderMode, selectedDate]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (leaderboardType === 'daily') {
        const response = await getDailyLeaderboard({
          date: selectedDate.toISOString().split('T')[0],
          gridSize,
          orderMode,
        });
        setEntries(response.entries);
      } else {
        const response = await getAllTimeLeaderboard({
          gridSize,
          orderMode,
          limit: 50,
        });
        setEntries(response.entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <main className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h1 className="text-xl font-bold">
            {language === 'vi' ? 'Bảng xếp hạng' : 'Leaderboards'}
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Type selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setLeaderboardType('daily')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all',
              leaderboardType === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Clock className="w-5 h-5" />
            {language === 'vi' ? 'Hôm nay' : 'Daily'}
          </button>
          <button
            onClick={() => setLeaderboardType('all-time')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all',
              leaderboardType === 'all-time'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Users className="w-5 h-5" />
            {language === 'vi' ? 'Mọi thời đại' : 'All Time'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <LeaderboardFilters
            gridSize={gridSize}
            orderMode={orderMode}
            selectedDate={leaderboardType === 'daily' ? selectedDate : undefined}
            onGridSizeChange={setGridSize}
            onOrderModeChange={setOrderMode}
            onDateChange={leaderboardType === 'daily' ? setSelectedDate : undefined}
            showDatePicker={leaderboardType === 'daily'}
            language={language}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Leaderboard table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <LeaderboardTable
            entries={entries}
            isLoading={isLoading}
            emptyMessage={
              language === 'vi'
                ? 'Chưa có dữ liệu cho cấu hình này'
                : 'No entries for this configuration yet'
            }
          />
        </div>
      </div>
    </main>
  );
}
