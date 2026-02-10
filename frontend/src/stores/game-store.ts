import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { GameState, GameStatus, TapEvent } from '@/types';
import {
  generateGrid,
  getStartingTarget,
  getNextTarget,
  isGameComplete,
  calculateAccuracy,
} from '@/lib/game-logic';
import { saveSession } from '@/lib/db';

interface GameStore extends GameState {
  // Actions
  initGame: (gridSize: number, maxTime: number, orderMode: 'ASC' | 'DESC') => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  handleCellTap: (value: number, cellIndex: number) => void;
  updateElapsedTime: (time: number) => void;
  endGame: (reason: 'completed' | 'timeout' | 'abandoned') => Promise<number | null>;
  resetGame: () => void;
}

const initialState: GameState = {
  status: 'idle',
  gridSize: 5,
  maxTime: 120,
  orderMode: 'ASC',
  grid: [],
  currentTarget: 1,
  mistakes: 0,
  tapEvents: [],
  startTime: null,
  elapsedTime: 0,
  sessionId: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initGame: (gridSize, maxTime, orderMode) => {
    const grid = generateGrid(gridSize);
    const currentTarget = getStartingTarget(gridSize, orderMode);

    set({
      status: 'ready',
      gridSize,
      maxTime,
      orderMode,
      grid,
      currentTarget,
      mistakes: 0,
      tapEvents: [],
      startTime: null,
      elapsedTime: 0,
      sessionId: uuidv4(),
    });
  },

  startGame: () => {
    set({
      status: 'playing',
      startTime: Date.now(),
    });
  },

  pauseGame: () => {
    const { status } = get();
    if (status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    const { status } = get();
    if (status === 'paused') {
      set({ status: 'playing' });
    }
  },

  handleCellTap: (value, cellIndex) => {
    const { status, currentTarget, orderMode, gridSize, mistakes, tapEvents, startTime } = get();

    // Only process taps during playing state
    if (status !== 'playing') return;

    const timestampMs = startTime ? Date.now() - startTime : 0;
    const isCorrect = value === currentTarget;

    const tapEvent: TapEvent = {
      cellIndex,
      expectedValue: currentTarget,
      tappedValue: value,
      correct: isCorrect,
      timestampMs,
    };

    if (isCorrect) {
      const nextTarget = getNextTarget(currentTarget, orderMode);
      const gameComplete = isGameComplete(nextTarget, gridSize, orderMode);

      set({
        currentTarget: nextTarget,
        tapEvents: [...tapEvents, tapEvent],
        status: gameComplete ? 'completed' : 'playing',
      });

      // Auto-save when completed
      if (gameComplete) {
        get().endGame('completed');
      }
    } else {
      set({
        mistakes: mistakes + 1,
        tapEvents: [...tapEvents, tapEvent],
      });
    }
  },

  updateElapsedTime: (time) => {
    const { status, maxTime } = get();
    if (status !== 'playing') return;

    set({ elapsedTime: time });

    // Check for timeout
    if (time >= maxTime * 1000) {
      set({ status: 'timeout' });
      get().endGame('timeout');
    }
  },

  endGame: async (reason) => {
    const { gridSize, maxTime, orderMode, elapsedTime, mistakes, tapEvents, sessionId } = get();

    if (!sessionId) return null;

    const totalCells = gridSize * gridSize;
    const accuracy = calculateAccuracy(totalCells, mistakes);

    const session = {
      oderId: sessionId,
      gridSize,
      maxTime,
      orderMode,
      startedAt: new Date(Date.now() - elapsedTime).toISOString(),
      completedAt: new Date().toISOString(),
      status: reason,
      completionTimeMs: elapsedTime,
      mistakes,
      accuracy,
      tapEvents,
    };

    try {
      const id = await saveSession(session);
      set({ status: reason === 'completed' ? 'completed' : reason === 'timeout' ? 'timeout' : 'idle' });
      return id;
    } catch (error) {
      console.error('Failed to save session:', error);
      return null;
    }
  },

  resetGame: () => {
    set(initialState);
  },
}));
