'use client';

import { useRouter } from 'next/navigation';
import { Pause, Play, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';

export function GameControls() {
  const router = useRouter();
  const { status, pauseGame, resumeGame, endGame, resetGame, gridSize, maxTime, orderMode, initGame } =
    useGameStore();

  const handlePauseResume = () => {
    if (status === 'playing') {
      pauseGame();
    } else if (status === 'paused') {
      resumeGame();
    }
  };

  const handleRestart = () => {
    resetGame();
    initGame(gridSize, maxTime, orderMode);
  };

  const handleQuit = async () => {
    if (status === 'playing' || status === 'paused') {
      await endGame('abandoned');
    }
    resetGame();
    router.push('/');
  };

  const canPause = status === 'playing' || status === 'paused';
  const canRestart = status !== 'idle';
  const isFinished = status === 'completed' || status === 'timeout';

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Home button */}
      <Button variant="outline" size="icon" onClick={handleQuit} title="Return home">
        <Home className="h-5 w-5" />
      </Button>

      {/* Pause/Resume button */}
      {canPause && !isFinished && (
        <Button variant="outline" size="icon" onClick={handlePauseResume} title={status === 'playing' ? 'Pause' : 'Resume'}>
          {status === 'playing' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
      )}

      {/* Restart button */}
      {canRestart && (
        <Button variant="outline" size="icon" onClick={handleRestart} title="Restart">
          <RotateCcw className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
