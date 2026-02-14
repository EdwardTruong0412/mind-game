/**
 * Leaderboard Table Component
 * Displays leaderboard entries in a table format
 */

import { Trophy, Medal } from 'lucide-react';
import { formatTimeShort } from '@/lib/game-logic';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/api';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function LeaderboardTable({ entries, currentUserId, isLoading, emptyMessage }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <Trophy className="w-12 h-12 mb-4 opacity-50" />
        <p>{emptyMessage || 'No entries yet'}</p>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    } else if (rank === 2) {
      return <Medal className="w-5 h-5 text-gray-400" />;
    } else if (rank === 3) {
      return <Medal className="w-5 h-5 text-amber-600" />;
    }
    return <span className="w-5 text-center font-medium text-gray-500">{rank}</span>;
  };

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={`${entry.user_id}-${entry.rank}`}
          className={cn(
            'flex items-center gap-4 p-4 rounded-lg transition-all',
            entry.user_id === currentUserId
              ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          )}
        >
          {/* Rank */}
          <div className="flex-shrink-0 w-8 flex items-center justify-center">
            {getRankIcon(entry.rank)}
          </div>

          {/* Avatar & Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                {entry.display_name ? entry.display_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {entry.display_name ?? 'Anonymous'}
                  {entry.user_id === currentUserId && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(entry.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-bold">{formatTimeShort(entry.best_time_ms)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
