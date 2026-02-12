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

    // Version 1: Initial schema
    this.version(1).stores({
      sessions: '++id, oderId, startedAt, gridSize, status',
      profile: 'id',
    });

    // Version 2: Add sync status fields
    this.version(2).stores({
      sessions: '++id, oderId, startedAt, gridSize, status, syncStatus',
      profile: 'id',
    }).upgrade(async (tx) => {
      // Add default sync status to existing sessions
      await tx.table('sessions').toCollection().modify((session: TrainingSession) => {
        session.syncStatus = 'local-only';
      });
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
  // Ensure sync status is set (default to local-only for new sessions)
  if (!session.syncStatus) {
    session.syncStatus = 'local-only';
  }

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

// Sync-related functions

/**
 * Update sync status for a session
 */
export async function updateSessionSyncStatus(
  oderId: string,
  syncStatus: TrainingSession['syncStatus'],
  options?: {
    cloudId?: string;
    syncedAt?: string;
    syncError?: string;
  }
): Promise<void> {
  const session = await db.sessions.where('oderId').equals(oderId).first();
  if (!session) {
    console.warn(`Session ${oderId} not found`);
    return;
  }

  const updates: Partial<TrainingSession> = { syncStatus };

  if (options?.cloudId) {
    updates.cloudId = options.cloudId;
  }
  if (options?.syncedAt) {
    updates.syncedAt = options.syncedAt;
  }
  if (options?.syncError) {
    updates.syncError = options.syncError;
  }

  await db.sessions.where('oderId').equals(oderId).modify(updates);
}

/**
 * Get all unsynced sessions (local-only or sync-failed)
 */
export async function getUnsyncedSessions(): Promise<TrainingSession[]> {
  return db.sessions
    .where('syncStatus')
    .equals('local-only')
    .or('syncStatus')
    .equals('sync-failed')
    .toArray();
}

/**
 * Get sessions that failed to sync
 */
export async function getFailedSyncSessions(): Promise<TrainingSession[]> {
  return db.sessions.where('syncStatus').equals('sync-failed').toArray();
}

/**
 * Get a session by oderId
 */
export async function getSessionByOderId(oderId: string): Promise<TrainingSession | undefined> {
  return db.sessions.where('oderId').equals(oderId).first();
}
