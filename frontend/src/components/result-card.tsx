'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Clock, Target, Zap, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '@/stores/game-store';
import { useSettings } from '@/hooks/use-settings';
import { formatTime } from '@/lib/game-logic';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ResultCard() {
  const router = useRouter();
  const { status, gridSize, orderMode, elapsedTime, mistakes, resetGame, initGame, maxTime } = useGameStore();
  const { stats } = useSettings();

  if (status !== 'completed' && status !== 'timeout') {
    return null;
  }

  const isCompleted = status === 'completed';
  const totalCells = gridSize * gridSize;
  const accuracy = Math.round(((totalCells - mistakes) / (totalCells + mistakes)) * 100) || 100;
  const key = `${gridSize}-${orderMode}`;
  const bestTime = (stats.bestTimes as Record<string, number>)[key];
  const isNewBest = isCompleted && bestTime && elapsedTime <= bestTime;

  const handlePlayAgain = () => {
    resetGame();
    initGame(gridSize, maxTime, orderMode);
  };

  const handleGoHome = () => {
    resetGame();
    router.push('/');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className={cn(
          'bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-6',
          isCompleted ? 'border-t-4 border-green-500' : 'border-t-4 border-red-500'
        )}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          {isCompleted ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <Trophy className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isNewBest ? 'New Best!' : 'Completed!'}
              </h2>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30">
                <Clock className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Time&apos;s Up!
              </h2>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <div className="text-xs text-gray-500 dark:text-gray-400">Accuracy</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {accuracy}%
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-xs text-gray-500 dark:text-gray-400">Grid</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {gridSize}×{gridSize}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-red-500" />
            <div className="text-xs text-gray-500 dark:text-gray-400">Mistakes</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {mistakes}
            </div>
          </div>
        </div>

        {/* Best time comparison */}
        {bestTime && isCompleted && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            {isNewBest ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                New personal best!
              </span>
            ) : (
              <span>
                Personal best: {formatTime(bestTime)}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleGoHome}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <Button className="flex-1" onClick={handlePlayAgain}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
