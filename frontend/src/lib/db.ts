import Dexie, { type EntityTable } from 'dexie';
import type { TrainingSession, UserProfile } from '@/types';

// Default user preferences
export const defaultPreferences = {
  theme: 'system' as const,
  hapticFeedback: true,
  soundEffects: false,
  showHints: false,
  showFixationDot: true,
  defaultGridSize: 5,
  defaultMaxTime: 120,
};

// Default user stats
export const defaultStats = {
  totalSessions: 0,
  completedSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedAt: null,
  bestTimes: {},
  avgTimes: {},
};

// Database class
class SchulteDatabase extends Dexie {
  sessions!: EntityTable<TrainingSession, 'id'>;
  profile!: EntityTable<UserProfile, 'id'>;

  constructor() {
    super('SchulteDB');

    this.version(1).stores({
      sessions: '++id, oderId, startedAt, gridSize, status',
      profile: 'id',
    });
  }
}

// Single database instance
export const db = new SchulteDatabase();

// Helper functions
export async function getOrCreateProfile(): Promise<UserProfile> {
  const existing = await db.profile.get('local');

  if (existing) {
    return existing;
  }

  const newProfile: UserProfile = {
    id: 'local',
    createdAt: new Date().toISOString(),
    preferences: defaultPreferences,
    stats: defaultStats,
  };

  await db.profile.add(newProfile);
  return newProfile;
}

export async function updatePreferences(
  updates: Partial<UserProfile['preferences']>
): Promise<void> {
  const profile = await getOrCreateProfile();
  await db.profile.update('local', {
    preferences: { ...profile.preferences, ...updates },
  });
}

export async function updateStats(
  updates: Partial<UserProfile['stats']>
): Promise<void> {
  const profile = await getOrCreateProfile();
  await db.profile.update('local', {
    stats: { ...profile.stats, ...updates },
  });
}

export async function saveSession(session: TrainingSession): Promise<number> {
  const id = await db.sessions.add(session);

  // Update stats
  const profile = await getOrCreateProfile();
  const stats = profile.stats;
  const key = `${session.gridSize}-${session.orderMode}`;

  const newStats: Partial<UserProfile['stats']> = {
    totalSessions: stats.totalSessions + 1,
    lastPlayedAt: new Date().toISOString(),
  };

  if (session.status === 'completed') {
    newStats.completedSessions = stats.completedSessions + 1;

    // Update best time
    if (!stats.bestTimes[key] || session.completionTimeMs < stats.bestTimes[key]) {
      newStats.bestTimes = { ...stats.bestTimes, [key]: session.completionTimeMs };
    }

    // Update average time
    const sessions = await db.sessions
      .where({ gridSize: session.gridSize, orderMode: session.orderMode, status: 'completed' })
      .toArray();

    const totalTime = sessions.reduce((sum, s) => sum + s.completionTimeMs, 0);
    const avgTime = Math.round(totalTime / sessions.length);
    newStats.avgTimes = { ...stats.avgTimes, [key]: avgTime };

    // Update streak
    const today = new Date().toDateString();
    const lastPlayed = stats.lastPlayedAt ? new Date(stats.lastPlayedAt).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastPlayed === today) {
      // Already played today, keep streak
    } else if (lastPlayed === yesterday) {
      // Consecutive day
      newStats.currentStreak = stats.currentStreak + 1;
      if (newStats.currentStreak > stats.longestStreak) {
        newStats.longestStreak = newStats.currentStreak;
      }
    } else {
      // Streak broken or first session
      newStats.currentStreak = 1;
      if (stats.longestStreak === 0) {
        newStats.longestStreak = 1;
      }
    }
  }

  await updateStats(newStats);
  return id as number;
}

export async function getRecentSessions(limit = 50): Promise<TrainingSession[]> {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function getSessionById(id: number): Promise<TrainingSession | undefined> {
  return db.sessions.get(id);
}

export async function deleteSession(id: number): Promise<void> {
  await db.sessions.delete(id);
}
