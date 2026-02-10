'use client';

import { useGameStore } from '@/stores/game-store';
import { formatTime } from '@/lib/game-logic';
import { cn } from '@/lib/utils';

export function TimerDisplay() {
  const { elapsedTime, maxTime, status } = useGameStore();

  const remainingTime = Math.max(0, maxTime * 1000 - elapsedTime);
  const progress = Math.min(100, (elapsedTime / (maxTime * 1000)) * 100);
  const isLowTime = remainingTime < 10000 && status === 'playing';

  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      {/* Time display */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Elapsed
        </div>
        <div
          className={cn(
            'text-3xl font-mono font-bold tabular-nums',
            isLowTime && 'text-red-500 animate-pulse'
          )}
        >
          {formatTime(elapsedTime)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          / {formatTime(maxTime * 1000)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-100 rounded-full',
            progress < 50 && 'bg-green-500',
            progress >= 50 && progress < 80 && 'bg-yellow-500',
            progress >= 80 && 'bg-red-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
