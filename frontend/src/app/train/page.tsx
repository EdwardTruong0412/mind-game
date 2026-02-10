'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SchulteGrid } from '@/components/schulte-grid';
import { TimerDisplay } from '@/components/timer-display';
import { GameControls } from '@/components/game-controls';
import { GameStats } from '@/components/game-stats';
import { ResultCard } from '@/components/result-card';
import { useGameStore } from '@/stores/game-store';
import { useTimer } from '@/hooks/use-timer';

export default function TrainPage() {
  const router = useRouter();
  const { status, gridSize } = useGameStore();

  // Initialize timer hook (handles Web Worker)
  useTimer();

  // Redirect to home if no game is initialized
  useEffect(() => {
    if (status === 'idle') {
      router.push('/');
    }
  }, [status, router]);

  // Don't render if not initialized
  if (status === 'idle') {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      {/* Header with controls */}
      <header className="mb-4">
        <GameControls />
      </header>

      {/* Timer */}
      <div className="mb-4">
        <TimerDisplay />
      </div>

      {/* Game stats */}
      <div className="mb-4">
        <GameStats />
      </div>

      {/* Grid */}
      <div className="flex-1 flex items-center justify-center">
        <SchulteGrid />
      </div>

      {/* Instructions */}
      {status === 'ready' && (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-4">
          <p>Tap the first number to start</p>
        </div>
      )}

      {/* Result overlay */}
      <ResultCard />
    </main>
  );
}
