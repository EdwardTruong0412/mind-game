// Training session types
export interface TapEvent {
  cellIndex: number;
  expectedValue: number;
  tappedValue: number;
  correct: boolean;
  timestampMs: number;
}

export interface TrainingSession {
  id?: number;
  oderId: string;
  gridSize: number;
  maxTime: number;
  orderMode: 'ASC' | 'DESC';
  startedAt: string;
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'timeout' | 'abandoned';
  completionTimeMs: number;
  mistakes: number;
  accuracy: number;
  tapEvents: TapEvent[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  soundEffects: boolean;
  showHints: boolean;
  showFixationDot: boolean;
  defaultGridSize: number;
  defaultMaxTime: number;
}

export interface UserStats {
  totalSessions: number;
  completedSessions: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: string | null;
  bestTimes: Record<string, number>;
  avgTimes: Record<string, number>;
}

export interface UserProfile {
  id: string;
  createdAt: string;
  preferences: UserPreferences;
  stats: UserStats;
}

// Game state types
export type GameStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'completed' | 'timeout';

export interface GameState {
  status: GameStatus;
  gridSize: number;
  maxTime: number;
  orderMode: 'ASC' | 'DESC';
  grid: number[];
  currentTarget: number;
  mistakes: number;
  tapEvents: TapEvent[];
  startTime: number | null;
  elapsedTime: number;
  sessionId: string | null;
}

export interface GridCell {
  value: number;
  index: number;
  status: 'default' | 'correct' | 'incorrect' | 'completed';
}
