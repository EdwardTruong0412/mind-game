'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/game-store';
import { useSettings } from '@/hooks/use-settings';
import { triggerHaptic, isCenterCell } from '@/lib/game-logic';
import { cn } from '@/lib/utils';

interface CellState {
  status: 'default' | 'correct' | 'incorrect' | 'completed';
}

export function SchulteGrid() {
  const { grid, gridSize, currentTarget, status, orderMode, handleCellTap, startGame } = useGameStore();
  const { preferences } = useSettings();
  const [cellStates, setCellStates] = useState<Record<number, CellState>>({});

  // Reset cell states when game resets
  useEffect(() => {
    if (status === 'ready' || status === 'idle') {
      setCellStates({});
    }
  }, [status]);

  const handleTap = useCallback(
    (value: number, index: number) => {
      // Start game on first tap if ready
      if (status === 'ready') {
        startGame();
      }

      if (status !== 'ready' && status !== 'playing') return;

      const isCorrect = value === currentTarget;

      // Update cell state
      setCellStates((prev) => ({
        ...prev,
        [index]: { status: isCorrect ? 'correct' : 'incorrect' },
      }));

      // Haptic feedback
      if (preferences.hapticFeedback) {
        triggerHaptic(isCorrect ? 'success' : 'error');
      }

      // Handle the tap in store
      handleCellTap(value, index);

      // Clear incorrect state after animation
      if (!isCorrect) {
        setTimeout(() => {
          setCellStates((prev) => ({
            ...prev,
            [index]: { status: 'default' },
          }));
        }, 300);
      }
    },
    [status, currentTarget, handleCellTap, startGame, preferences.hapticFeedback]
  );

  // Calculate which cells are completed
  const getCompletedCells = useCallback(() => {
    const completed = new Set<number>();
    if (orderMode === 'ASC') {
      for (let i = 1; i < currentTarget; i++) {
        const index = grid.indexOf(i);
        if (index !== -1) completed.add(index);
      }
    } else {
      const max = gridSize * gridSize;
      for (let i = max; i > currentTarget; i--) {
        const index = grid.indexOf(i);
        if (index !== -1) completed.add(index);
      }
    }
    return completed;
  }, [grid, currentTarget, orderMode, gridSize]);

  const completedCells = getCompletedCells();

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      {/* Fixation dot */}
      {preferences.showFixationDot && gridSize % 2 === 1 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-2 h-2 rounded-full bg-red-500 opacity-70" />
        </div>
      )}

      {/* Grid */}
      <div
        className="grid gap-1 w-full h-full p-1"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        }}
      >
        <AnimatePresence mode="sync">
          {grid.map((value, index) => {
            const cellState = cellStates[index]?.status ?? 'default';
            const isCompleted = completedCells.has(index);
            const isHinted = preferences.showHints && value === currentTarget;
            const isCenter = isCenterCell(index, gridSize);

            return (
              <motion.button
                key={`${index}-${value}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                onClick={() => handleTap(value, index)}
                disabled={status === 'completed' || status === 'timeout' || status === 'paused' || isCompleted}
                className={cn(
                  'relative flex items-center justify-center rounded-lg font-bold text-xl sm:text-2xl md:text-3xl transition-all duration-150 select-none touch-manipulation',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  // Default state
                  cellState === 'default' && !isCompleted && 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md hover:shadow-lg active:scale-95',
                  // Correct tap
                  cellState === 'correct' && 'bg-green-500 text-white scale-95',
                  // Incorrect tap
                  cellState === 'incorrect' && 'bg-red-500 text-white animate-shake',
                  // Completed cell
                  isCompleted && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 opacity-60',
                  // Hint
                  isHinted && !isCompleted && 'ring-2 ring-yellow-400 ring-offset-2',
                  // Disabled
                  (status === 'completed' || status === 'timeout' || status === 'paused') && 'cursor-not-allowed'
                )}
              >
                <span className={cn(isCenter && preferences.showFixationDot && 'opacity-0')}>
                  {value}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Overlay for paused state */}
      {status === 'paused' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <span className="text-white text-2xl font-bold">PAUSED</span>
        </div>
      )}
    </div>
  );
}
