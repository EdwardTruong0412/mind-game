'use client';

import { Target, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/stores/game-store';

export function GameStats() {
  const { gridSize, currentTarget, orderMode, mistakes, status } = useGameStore();

  const totalCells = gridSize * gridSize;
  const progress =
    orderMode === 'ASC'
      ? currentTarget - 1
      : totalCells - currentTarget;

  const progressPercent = Math.round((progress / totalCells) * 100);

  return (
    <div className="flex items-center justify-between w-full max-w-md mx-auto text-sm">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Target className="w-4 h-4" />
        <span>
          {status === 'ready' ? (
            `Find: ${currentTarget}`
          ) : status === 'playing' || status === 'paused' ? (
            `Next: ${currentTarget}`
          ) : (
            `Progress: ${progressPercent}%`
          )}
        </span>
      </div>

      <div className="text-gray-500 dark:text-gray-500">
        {progress} / {totalCells}
      </div>

      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <AlertCircle className="w-4 h-4" />
        <span>{mistakes} mistakes</span>
      </div>
    </div>
  );
}
