# Frontend-Backend Integration Guide

**Schulte Table Training App - Complete Integration Documentation**

This guide explains the complete frontend-backend integration implemented for the Schulte Table Training App, including authentication, cloud sync, user profiles, and leaderboards.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication System](#authentication-system)
3. [Session Sync System](#session-sync-system)
4. [User Profile & Preferences](#user-profile--preferences)
5. [Leaderboards](#leaderboards)
6. [File Structure](#file-structure)
7. [Key Concepts](#key-concepts)
8. [API Endpoints](#api-endpoints)
9. [Frontend Components](#frontend-components)
10. [State Management](#state-management)
11. [Usage & Testing](#usage--testing)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  React UI    │  │  Auth State  │  │  IndexedDB (Dexie)   │  │
│  │  (Next.js)   │←→│  (Context)   │←→│  Local Sessions      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         ↓                  ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            API Client (Token Management)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth Routes │  │  User Routes │  │  Session Routes      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         ↓                  ↓                   ↓                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth Service │  │ User Service │  │  Session Service     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         ↓                  ↓                   ↓                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐    │
│  │   Cognito    │  │       PostgreSQL Database            │    │
│  │   (AWS)      │  │  (Users, Sessions, Leaderboards)     │    │
│  └──────────────┘  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Offline-First**: App works completely offline, syncs when online
2. **Dual Mode**: Supports anonymous (local-only) and authenticated (cloud-sync) users
3. **Progressive Enhancement**: Cloud features don't break offline functionality
4. **Type Safety**: Full TypeScript/Python type coverage
5. **Security**: httpOnly cookies, token rotation, XSS protection

---

## Authentication System

### Overview

The auth system uses AWS Cognito for identity management with JWT tokens. Tokens are securely stored and automatically refreshed.

### Token Storage Strategy

```
┌──────────────────────────────────────────────────────────┐
│  Token Storage (Security-First Design)                   │
├──────────────────────────────────────────────────────────┤
│  Access Token   → React State (memory only)              │
│  ID Token       → React State (memory only)              │
│  Refresh Token  → httpOnly Cookie (backend-set)          │
│  Token Metadata → localStorage (expiresAt, lastRefresh)  │
└──────────────────────────────────────────────────────────┘
```

**Why this approach?**
- **Access/ID tokens in memory**: Not accessible to XSS attacks, cleared on page close
- **Refresh token in httpOnly cookie**: Can't be read by JavaScript, automatic with requests
- **Metadata in localStorage**: Only stores non-sensitive expiry info for refresh scheduling

### Authentication Flow

#### 1. Registration Flow

```
User → Register Form → Backend → Cognito.SignUp()
                          ↓
                    Local DB User Created
                          ↓
                    Email Sent (Cognito)
                          ↓
User → Confirm Email → Backend → Cognito.ConfirmSignUp()
                          ↓
                    Email Verified ✓
```

**Frontend Files**:
- `app/auth/register/page.tsx` - Registration page
- `components/auth/register-form.tsx` - Form component
- `lib/api/auth.ts` - `register()` function

**Backend Files**:
- `app/api/v1/auth.py` - `/auth/register` endpoint
- `app/services/auth.py` - `AuthService.register()`

#### 2. Login Flow

```
User → Login Form → Backend → Cognito.InitiateAuth()
                        ↓
                  Tokens Retrieved
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
    Access Token (memory)  Refresh Token (httpOnly cookie)
              ↓                   ↓
        Frontend State      Auto-sent with requests
              ↓
      User Profile Fetched
              ↓
    Bulk Sync Local Sessions
```

**Frontend Files**:
- `app/auth/login/page.tsx` - Login page
- `contexts/auth-context.tsx` - `handleLogin()` function
- `lib/api/auth.ts` - `login()` function

**Backend Files**:
- `app/api/v1/auth.py` - `/auth/login` endpoint (sets cookie)
- `app/services/auth.py` - `AuthService.login()`

**Backend Cookie Settings**:
```python
response.set_cookie(
    key="refresh_token",
    value=tokens["refresh_token"],
    httponly=True,              # Not accessible via JavaScript
    secure=True,                # HTTPS only (production)
    samesite="lax",            # CSRF protection
    max_age=30 * 24 * 60 * 60, # 30 days
    path="/",
)
```

#### 3. Token Refresh Flow

```
API Request → 401 Unauthorized
                 ↓
        API Client Detects Expiry
                 ↓
    POST /auth/refresh (cookie auto-sent)
                 ↓
         Backend → Cognito.RefreshToken()
                 ↓
         New Tokens Returned
                 ↓
    Frontend Updates State
                 ↓
    Original Request Retried
```

**Auto-Refresh Triggers**:
1. 401 response from any API call
2. Token expires in < 5 minutes (proactive refresh)
3. Checked every 60 seconds by timer

**Frontend Files**:
- `lib/api-client.ts` - Handles 401 and retry logic
- `contexts/auth-context.tsx` - Token refresh timer

#### 4. Logout Flow

```
User → Logout Button → Backend → Cognito.GlobalSignOut()
                          ↓
                  Cookie Cleared
                          ↓
            Frontend State Cleared
                          ↓
            User ID → "local"
```

**What happens on logout**:
- All tokens invalidated on Cognito
- httpOnly cookie deleted
- React state cleared
- User returns to anonymous mode
- Local data preserved (not deleted)

### Auth Context API

The `AuthContext` provides these methods throughout the app:

```typescript
interface AuthContextValue {
  // State
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Methods
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}
```

**Usage in components**:
```typescript
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  // Use auth state and methods
}
```

---

## Session Sync System

### Overview

The sync system bridges the offline-first frontend (IndexedDB) with the cloud backend (PostgreSQL), ensuring training sessions are seamlessly synced.

### Sync Strategy

```
┌─────────────────────────────────────────────────────────┐
│  Multi-Tiered Sync Strategy                             │
├─────────────────────────────────────────────────────────┤
│  1. On Login      → Bulk sync all local sessions        │
│  2. Real-time     → Immediate sync after session save   │
│  3. Background    → Retry failed syncs every 60s        │
│  4. On Demand     → Manual retry via UI                 │
└─────────────────────────────────────────────────────────┘
```

### Session Lifecycle with Sync

```
Game Start
    ↓
User Plays
    ↓
Game End → Save to IndexedDB
    ↓
  syncStatus: "local-only"
    ↓
Is User Authenticated? ─[No]─→ Stay "local-only"
    ↓ [Yes]
  syncStatus: "syncing"
    ↓
POST /api/v1/sessions
    ↓
Success? ─[No]─→ syncStatus: "sync-failed" → Retry Queue
    ↓ [Yes]
  syncStatus: "synced"
    ↓
  cloudId & syncedAt stored
```

### Sync Status States

```typescript
type SyncStatus =
  | 'local-only'   // Not synced (user anonymous or offline)
  | 'syncing'      // Currently uploading
  | 'synced'       // Successfully synced
  | 'sync-failed'  // Failed, will retry
```

### Database Schema Updates

**TrainingSession Type (Frontend)**:
```typescript
interface TrainingSession {
  // Existing fields
  id?: number;
  oderId: string;              // Client-generated UUID
  gridSize: number;
  // ... other fields

  // NEW: Sync fields
  syncStatus: SyncStatus;      // Current sync state
  cloudId?: string;            // Backend-generated ID
  syncedAt?: string;           // When last synced
  syncError?: string;          // Error message if failed
}
```

**IndexedDB Schema (Dexie)**:
```typescript
// Version 2: Added sync status tracking
this.version(2).stores({
  sessions: '++id, oderId, startedAt, gridSize, status, syncStatus',
  profile: 'id',
});
```

### Sync Functions

#### 1. Single Session Sync

```typescript
// lib/sync.ts
async function syncSingleSession(session: TrainingSession): Promise<void> {
  // 1. Mark as syncing
  await db.updateSessionSyncStatus(session.oderId, 'syncing');

  try {
    // 2. POST to backend
    const response = await saveSession(session);

    // 3. Mark as synced
    await db.updateSessionSyncStatus(session.oderId, 'synced', {
      cloudId: response.session.id,
      syncedAt: response.session.created_at,
    });
  } catch (error) {
    // 4. Mark as failed (will retry)
    await db.updateSessionSyncStatus(session.oderId, 'sync-failed', {
      syncError: error.message,
    });
    throw error;
  }
}
```

**When called**:
- After game ends (if authenticated)
- Manual retry from UI
- Background retry for failed syncs

#### 2. Bulk Sync (On Login)

```typescript
// lib/sync.ts
async function bulkSyncLocalSessions(): Promise<SyncResult> {
  // 1. Get all unsynced sessions
  const localSessions = await db.getUnsyncedSessions();

  if (localSessions.length === 0) {
    return { syncedCount: 0, failedCount: 0, errors: [] };
  }

  // 2. Mark all as syncing
  await Promise.all(
    localSessions.map(s => db.updateSessionSyncStatus(s.oderId, 'syncing'))
  );

  // 3. Bulk POST to backend
  const response = await syncSessions(localSessions);

  // 4. Update sync status for each
  for (const cloudSession of response.sessions) {
    await db.updateSessionSyncStatus(cloudSession.client_session_id, 'synced', {
      cloudId: cloudSession.id,
      syncedAt: cloudSession.created_at,
    });
  }

  return {
    syncedCount: response.synced_count,
    failedCount: response.failed_count,
    errors: [],
  };
}
```

**When called**:
- Automatically on login (background, non-blocking)
- Manual trigger from sync progress modal

#### 3. Retry Failed Syncs (Background)

```typescript
// hooks/use-sync.ts
useEffect(() => {
  if (!isAuthenticated) return;

  const interval = setInterval(async () => {
    if (!isSyncing && navigator.onLine) {
      await retryFailed();
    }
  }, 60000); // Every 60 seconds

  return () => clearInterval(interval);
}, [isAuthenticated, isSyncing]);
```

### Sync UI Components

#### Sync Status Indicator

Shows the current sync state with an icon:

```typescript
// components/sync/sync-status-indicator.tsx
<SyncStatusIndicator status={session.syncStatus} />

// Renders:
// ☁️  synced      (green cloud)
// ⬆️  syncing     (blue cloud with upload, animated)
// ⚠️  sync-failed (red alert circle)
// 🚫 local-only   (gray cloud-off)
```

**Used in**:
- History page (each session)
- Session detail modals

#### Sync Progress Modal

Shows bulk sync progress on first login:

```typescript
// components/sync/sync-progress-modal.tsx
<SyncProgressModal
  isOpen={showSyncModal}
  onClose={() => setShowSyncModal(false)}
  onComplete={() => {
    showToast('success', 'All sessions synced!');
  }}
/>

// Shows:
// - Spinner while syncing
// - ✓ X sessions synced successfully
// - ✗ Y sessions failed to sync
// - Detailed error messages
```

### API Integration

#### Backend Endpoints

**Save Single Session**:
```
POST /api/v1/sessions
Body: {
  client_session_id: "uuid",
  grid_size: 5,
  order_mode: "sequential",
  completion_time: 45.2,  // seconds
  is_completed: true,
  error_count: 2,
  tap_events: [...]
}
Response: { session: { id: "backend-id", ... } }
```

**Bulk Sync Sessions**:
```
POST /api/v1/sessions/sync
Body: {
  sessions: [
    { client_session_id: "uuid1", ... },
    { client_session_id: "uuid2", ... },
    ...
  ]
}
Response: {
  synced_count: 10,
  failed_count: 0,
  sessions: [...]
}
```

**Session Idempotency**:
- `client_session_id` (frontend's `oderId`) ensures duplicate protection
- Backend checks for existing sessions with same `client_session_id`
- Re-uploading same session won't create duplicates

---

## User Profile & Preferences

### Overview

User profiles sync between local storage and the backend, allowing preferences and stats to persist across devices.

### Profile Structure

```typescript
interface UserProfile {
  // Identity
  id: string;              // Cognito sub
  email: string;
  display_name: string;
  avatar_url: string | null;

  // Preferences (synced)
  preferences: {
    grid_size: number;
    order_mode: 'sequential' | 'random';
    language: 'en' | 'vi';
    sound_enabled: boolean;
    // Local-only (not synced):
    // - theme
    // - haptic_feedback
    // - show_hints
    // - show_fixation_dot
  };

  // Stats (synced)
  stats: {
    total_sessions: number;
    total_time: number;
    best_time: number | null;
    average_time: number | null;
    last_session_at: string | null;
  };
}
```

### Profile Sync Strategy

```
┌──────────────────────────────────────────────────────────┐
│  Profile Sync Flow                                       │
├──────────────────────────────────────────────────────────┤
│  1. On Login    → Fetch profile from backend            │
│  2. On Change   → Update local immediately               │
│  3. After 500ms → Debounced sync to backend             │
│  4. On Conflict → Backend is source of truth             │
└──────────────────────────────────────────────────────────┘
```

### Preference Syncing

**Frontend (use-settings.ts)**:
```typescript
const updateSetting = useCallback(
  async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    // 1. Update local immediately (optimistic update)
    await updatePreferences({ [key]: value });

    // 2. Debounce sync to backend (500ms)
    if (userId !== 'local') {
      // Clear existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // Schedule sync
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await updatePreferencesApi({ [backendKey]: value });
        } catch (error) {
          console.error('Failed to sync preference:', error);
          // Non-blocking - local preference already saved
        }
      }, 500);
    }
  },
  []
);
```

**Backend Endpoint**:
```
PATCH /api/v1/users/me/preferences
Body: {
  grid_size?: number,
  order_mode?: "sequential" | "random",
  language?: "en" | "vi",
  sound_enabled?: boolean
}
```

### Profile Edit UI

**Profile Edit Modal**:
```typescript
// components/profile/profile-edit-modal.tsx
<ProfileEditModal
  isOpen={showProfileEdit}
  onClose={() => setShowProfileEdit(false)}
/>

// Allows editing:
// - Display Name
// - Avatar URL
```

**Accessed from**:
- Settings modal → Account section → Edit button

### Stats Merging

When displaying stats, local and cloud stats are merged:

```typescript
// Pseudocode
const displayStats = {
  totalSessions: localStats.totalSessions + cloudStats.totalSessions,
  bestTime: Math.min(localStats.bestTime, cloudStats.bestTime),
  // ... other stats
};
```

This ensures accurate stats even if some sessions haven't synced yet.

---

## Leaderboards

### Overview

Leaderboards display global rankings for training sessions, with separate boards for different configurations.

### Leaderboard Types

```
┌──────────────────────────────────────────────────────────┐
│  Leaderboard Types                                       │
├──────────────────────────────────────────────────────────┤
│  Daily      → Best times for specific date               │
│  All-Time   → Best times across all dates                │
└──────────────────────────────────────────────────────────┘
```

### Filtering

Users can filter leaderboards by:
- **Grid Size**: 4×4 to 10×10
- **Order Mode**: Ascending (1→25) or Descending (25→1)
- **Date** (daily only): Navigate through past dates

### Leaderboard Entry Structure

```typescript
interface LeaderboardEntry {
  rank: number;              // 1, 2, 3, ...
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  completion_time: number;   // seconds
  grid_size: number;
  order_mode: 'sequential' | 'random';
  session_date: string;
  is_current_user?: boolean; // Highlighted in UI
}
```

### API Endpoints

**Daily Leaderboard**:
```
GET /api/v1/leaderboards/daily?grid_size=5&order_mode=sequential&date=2024-01-15
Response: {
  date: "2024-01-15",
  grid_size: 5,
  order_mode: "sequential",
  entries: [...],
  current_user_rank: 42  // or null if not on leaderboard
}
```

**All-Time Leaderboard**:
```
GET /api/v1/leaderboards/all-time?grid_size=5&order_mode=sequential&limit=50
Response: {
  grid_size: 5,
  order_mode: "sequential",
  entries: [...],
  current_user_rank: 137  // or null
}
```

### UI Components

#### Leaderboard Table

```typescript
// components/leaderboards/leaderboard-table.tsx
<LeaderboardTable
  entries={entries}
  isLoading={isLoading}
  emptyMessage="No entries yet for this configuration"
/>

// Features:
// - Top 3 get medal icons (🥇🥈🥉)
// - Current user highlighted in blue
// - Avatar images or initials
// - Responsive layout
```

#### Leaderboard Filters

```typescript
// components/leaderboards/leaderboard-filters.tsx
<LeaderboardFilters
  gridSize={gridSize}
  orderMode={orderMode}
  selectedDate={selectedDate}
  onGridSizeChange={setGridSize}
  onOrderModeChange={setOrderMode}
  onDateChange={setSelectedDate}
  showDatePicker={leaderboardType === 'daily'}
  language={language}
/>

// Features:
// - Grid size selector with arrows
// - Order mode toggle buttons
// - Date navigation (daily only)
// - Can't navigate to future dates
```

### Backend Data Generation

The backend automatically updates leaderboards when sessions are saved:

```python
# Pseudocode
async def save_session(session: SessionCreate):
    # 1. Save session to database
    db_session = await create_session(session)

    # 2. Update user stats (denormalized)
    await update_user_stats(db_session.user_id)

    # 3. Update daily leaderboard (denormalized)
    if db_session.is_completed:
        await update_daily_leaderboard(db_session)

    return db_session
```

This denormalization strategy ensures fast leaderboard queries without complex aggregations.

---

## File Structure

### Frontend Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                    # Root layout (providers)
│   ├── page.tsx                      # Home page (+ auth CTAs)
│   ├── auth/
│   │   ├── login/page.tsx           # Login page
│   │   ├── register/page.tsx        # Registration page
│   │   ├── confirm/page.tsx         # Email confirmation
│   │   ├── forgot-password/page.tsx # Forgot password
│   │   └── reset-password/page.tsx  # Reset password
│   ├── history/page.tsx             # Session history (+ sync status)
│   ├── leaderboards/page.tsx        # Leaderboards page
│   └── train/page.tsx               # Training game page
│
├── components/
│   ├── auth/
│   │   ├── login-form.tsx           # Reusable login form
│   │   └── register-form.tsx        # Reusable register form
│   ├── sync/
│   │   ├── sync-status-indicator.tsx   # Cloud icon with status
│   │   └── sync-progress-modal.tsx     # Bulk sync progress
│   ├── profile/
│   │   └── profile-edit-modal.tsx   # Profile editor
│   ├── leaderboards/
│   │   ├── leaderboard-table.tsx    # Ranked entries table
│   │   └── leaderboard-filters.tsx  # Filter controls
│   └── ui/
│       ├── toast/
│       │   └── toast-provider.tsx   # Toast notifications
│       ├── offline-detector.tsx     # Offline banner
│       └── error-boundary.tsx       # Error catcher
│
├── contexts/
│   └── auth-context.tsx             # Auth state provider
│
├── hooks/
│   ├── use-auth.ts                  # Auth context hook
│   ├── use-sync.ts                  # Sync state & actions
│   ├── use-settings.ts              # Settings (+ backend sync)
│   └── use-language.ts              # i18n hook
│
├── lib/
│   ├── api-client.ts                # HTTP client (token injection)
│   ├── api/
│   │   ├── auth.ts                  # Auth API functions
│   │   ├── users.ts                 # User API functions
│   │   ├── sessions.ts              # Session API functions
│   │   └── leaderboards.ts          # Leaderboard API functions
│   ├── sync.ts                      # Sync orchestration
│   ├── storage.ts                   # Token storage helpers
│   ├── db.ts                        # IndexedDB (Dexie) (+ sync)
│   └── i18n.ts                      # Translations (+ auth/leaderboards)
│
├── stores/
│   ├── game-store.ts                # Game state (+ sync trigger)
│   └── sync-store.ts                # Sync queue management
│
└── types/
    ├── index.ts                     # Core types (+ sync fields)
    ├── auth.ts                      # Auth types
    └── api.ts                       # API request/response types
```

### Backend Directory Structure

```
backend/app/
├── main.py                          # FastAPI app (+ CORS)
├── config.py                        # Settings
│
├── api/v1/
│   ├── auth.py                      # Auth routes (+ cookies)
│   ├── users.py                     # User routes
│   ├── sessions.py                  # Session routes
│   └── leaderboards.py              # Leaderboard routes
│
├── services/
│   ├── auth.py                      # Cognito integration
│   ├── user.py                      # User business logic
│   └── session.py                   # Session business logic
│
├── repositories/
│   ├── user.py                      # User data access
│   ├── session.py                   # Session data access
│   └── leaderboard.py               # Leaderboard data access
│
├── schemas/
│   ├── auth.py                      # Auth schemas (+ LoginResponse)
│   ├── user.py                      # User schemas
│   └── session.py                   # Session schemas
│
└── models/
    ├── user.py                      # User SQLAlchemy model
    ├── session.py                   # Session SQLAlchemy model
    └── leaderboard.py               # Leaderboard SQLAlchemy model
```

---

## Key Concepts

### 1. Offline-First Architecture

**Principle**: The app should work without a backend connection.

**Implementation**:
- All core features use IndexedDB (local storage)
- Backend is treated as an enhancement, not a requirement
- Sync is opportunistic: sync when possible, queue when not

**User Experience**:
```
Anonymous User (Offline)
  ↓
Plays Games → Saved Locally
  ↓
Creates Account → Still Plays Offline
  ↓
Connects to Internet
  ↓
Automatic Sync → Cloud Backup Created
  ↓
Logs Out → Returns to Offline Mode
  ↓
Data Preserved ✓
```

### 2. Dual Mode Support

**Anonymous Mode**:
- User ID = "local"
- All data in IndexedDB
- No backend interaction
- Full app functionality

**Authenticated Mode**:
- User ID = Cognito sub
- Data in IndexedDB + PostgreSQL
- Automatic sync
- Access to leaderboards

**Seamless Transition**:
- Login doesn't delete local data
- Bulk sync merges local sessions to cloud
- Logout doesn't delete local data
- Can switch between modes freely

### 3. Progressive Enhancement

**Core Features** (work offline):
- Play training games
- View personal history
- Track personal stats
- Customize settings

**Enhanced Features** (require auth):
- Cloud backup
- Multi-device sync
- Global leaderboards
- Social features (future)

### 4. Idempotency

**Problem**: Network requests can fail and retry, potentially creating duplicates.

**Solution**: Client-generated UUIDs

```typescript
// Frontend generates UUID
const sessionId = uuidv4(); // "a1b2c3d4-..."

// Sent to backend as client_session_id
POST /api/v1/sessions {
  client_session_id: "a1b2c3d4-...",
  ...
}

// Backend checks for duplicate
const existing = await findByClientSessionId("a1b2c3d4-...");
if (existing) {
  return existing; // Don't create duplicate
}
```

**Benefits**:
- Safe retries
- No duplicate data
- Consistent IDs across sync

### 5. Optimistic Updates

**Pattern**: Update UI immediately, sync in background

**Example - Preference Change**:
```typescript
async function changeSetting(key, value) {
  // 1. Update local state immediately
  await updateLocalPreferences({ [key]: value });
  // UI updates instantly ✓

  // 2. Sync to backend in background
  setTimeout(async () => {
    try {
      await updateBackendPreferences({ [key]: value });
    } catch (error) {
      // Non-blocking error
      console.error('Sync failed:', error);
    }
  }, 500);
}
```

**Benefits**:
- Instant UI response
- Better perceived performance
- Graceful degradation if sync fails

### 6. Error Recovery

**Retry Strategy**:
```
┌──────────────────────────────────────────────────────────┐
│  Error Recovery Levels                                   │
├──────────────────────────────────────────────────────────┤
│  1. Immediate Retry   → API client retries 401 once     │
│  2. Background Retry  → Failed syncs retry every 60s    │
│  3. User-Initiated    → Manual retry button in UI       │
│  4. On Reconnect      → Sync on network restore         │
└──────────────────────────────────────────────────────────┘
```

**Exponential Backoff** (future enhancement):
```typescript
// Could add exponential backoff for retries
const delay = Math.min(1000 * 2 ** retryCount, 60000);
```

---

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "display_name": "John Doe"
}
```

**Response**: 201 Created
```json
{
  "message": "Registration successful. Please check your email for a verification code."
}
```

---

#### POST /api/v1/auth/confirm
Confirm email with verification code.

**Request**:
```json
{
  "email": "user@example.com",
  "confirmation_code": "123456"
}
```

**Response**: 200 OK
```json
{
  "message": "Email confirmed successfully. You can now log in."
}
```

---

#### POST /api/v1/auth/login
Login and receive JWT tokens. **Refresh token is set as httpOnly cookie**.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**: 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "cognito-sub-uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "avatar_url": null
  }
}
```

**Response Headers**:
```
Set-Cookie: refresh_token=eyJjdHk...; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/
```

---

#### POST /api/v1/auth/refresh
Refresh access token. **Reads refresh token from httpOnly cookie**.

**Request**: (empty body, cookie auto-sent)
```json
{}
```

**Response**: 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

#### POST /api/v1/auth/logout
Logout and invalidate tokens. **Clears refresh token cookie**.

**Request Headers**:
```
Authorization: Bearer eyJhbGc...
```

**Response**: 200 OK
```json
{
  "message": "Logged out successfully"
}
```

**Response Headers**:
```
Set-Cookie: refresh_token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/
```

---

### User Endpoints

#### GET /api/v1/users/me
Get current user's profile.

**Response**: 200 OK
```json
{
  "id": "cognito-sub-uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "created_at": "2024-01-15T10:00:00Z",
  "preferences": {
    "grid_size": 5,
    "order_mode": "sequential",
    "language": "en",
    "sound_enabled": true
  },
  "stats": {
    "total_sessions": 42,
    "total_time": 1800.5,
    "best_time": 35.2,
    "average_time": 42.8,
    "last_session_at": "2024-01-20T15:30:00Z"
  }
}
```

---

#### PATCH /api/v1/users/me
Update user profile.

**Request**:
```json
{
  "display_name": "Jane Doe",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Response**: 200 OK (returns updated profile)

---

#### PATCH /api/v1/users/me/preferences
Update user preferences.

**Request**:
```json
{
  "grid_size": 6,
  "order_mode": "random",
  "language": "vi",
  "sound_enabled": false
}
```

**Response**: 200 OK (returns updated profile)

---

### Session Endpoints

#### POST /api/v1/sessions
Save a single training session.

**Request**:
```json
{
  "client_session_id": "a1b2c3d4-uuid",
  "grid_size": 5,
  "order_mode": "sequential",
  "completion_time": 45.2,
  "is_completed": true,
  "error_count": 2,
  "tap_events": [
    {
      "number": 1,
      "timestamp": 2.5,
      "x": 100,
      "y": 150,
      "is_correct": true
    },
    ...
  ]
}
```

**Response**: 201 Created
```json
{
  "session": {
    "id": "backend-uuid",
    "user_id": "cognito-sub-uuid",
    "client_session_id": "a1b2c3d4-uuid",
    "grid_size": 5,
    "order_mode": "sequential",
    "completion_time": 45.2,
    "is_completed": true,
    "error_count": 2,
    "tap_events": [...],
    "created_at": "2024-01-20T15:30:00Z"
  }
}
```

---

#### POST /api/v1/sessions/sync
Bulk sync multiple sessions.

**Request**:
```json
{
  "sessions": [
    {
      "client_session_id": "uuid-1",
      ...
    },
    {
      "client_session_id": "uuid-2",
      ...
    }
  ]
}
```

**Response**: 200 OK
```json
{
  "synced_count": 2,
  "failed_count": 0,
  "sessions": [...]
}
```

---

#### GET /api/v1/sessions
List user's sessions.

**Query Parameters**:
- `limit` (default: 50)
- `offset` (default: 0)

**Response**: 200 OK
```json
{
  "sessions": [...],
  "total": 42
}
```

---

### Leaderboard Endpoints

#### GET /api/v1/leaderboards/daily
Get daily leaderboard.

**Query Parameters**:
- `grid_size` (required): 4-10
- `order_mode` (required): "sequential" | "random"
- `date` (optional): ISO date (YYYY-MM-DD), defaults to today

**Response**: 200 OK
```json
{
  "date": "2024-01-20",
  "grid_size": 5,
  "order_mode": "sequential",
  "entries": [
    {
      "rank": 1,
      "user_id": "cognito-sub-1",
      "display_name": "Speed Master",
      "avatar_url": "https://...",
      "completion_time": 25.5,
      "grid_size": 5,
      "order_mode": "sequential",
      "session_date": "2024-01-20T10:30:00Z",
      "is_current_user": false
    },
    ...
  ],
  "current_user_rank": 42
}
```

---

#### GET /api/v1/leaderboards/all-time
Get all-time leaderboard.

**Query Parameters**:
- `grid_size` (required): 4-10
- `order_mode` (required): "sequential" | "random"
- `limit` (optional): max entries, default 50

**Response**: 200 OK
```json
{
  "grid_size": 5,
  "order_mode": "sequential",
  "entries": [...],
  "current_user_rank": 137
}
```

---

## Frontend Components

### Core Components

#### 1. AuthProvider (`contexts/auth-context.tsx`)

**Purpose**: Manages authentication state across the entire app.

**Responsibilities**:
- Store and provide auth state (user, tokens, isAuthenticated)
- Initialize API client with token injection
- Auto-refresh tokens before expiry
- Restore session on page load
- Provide auth methods (login, logout, register, etc.)

**Usage**:
```tsx
// Wrap app in layout.tsx
<AuthProvider>
  <YourApp />
</AuthProvider>

// Access in components
const { user, isAuthenticated, login } = useAuth();
```

---

#### 2. ToastProvider (`components/ui/toast/toast-provider.tsx`)

**Purpose**: Display temporary notifications.

**Types**:
- Success (green): "Session synced successfully"
- Error (red): "Failed to login"
- Info (blue): "Checking for updates..."

**Usage**:
```tsx
const { showToast } = useToast();

showToast('success', 'Profile updated!', 3000);
```

---

#### 3. ErrorBoundary (`components/ui/error-boundary.tsx`)

**Purpose**: Catch React errors and show fallback UI.

**Features**:
- Displays user-friendly error message
- Shows actual error in development
- Provides "Reload" and "Go Home" buttons
- Logs errors to console

**Usage**:
```tsx
// Wrap app in layout.tsx
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

---

#### 4. OfflineDetector (`components/ui/offline-detector.tsx`)

**Purpose**: Show banner when user is offline.

**Features**:
- Listens to browser online/offline events
- Shows yellow banner at top of screen
- Explains that data will sync when reconnected
- Auto-hides when back online

---

### Auth Components

#### LoginForm (`components/auth/login-form.tsx`)

**Features**:
- Email/password inputs
- Validation
- Loading state
- Error display
- Links to forgot password and register

#### RegisterForm (`components/auth/register-form.tsx`)

**Features**:
- Email, password, confirm password, display name inputs
- Client-side validation (password length, match)
- Redirects to confirm page on success

#### Auth Pages

All auth pages share a consistent design:
- Centered card layout
- Gradient background
- Logo at top
- Form in middle
- "Back to Home" link at bottom

---

### Sync Components

#### SyncStatusIndicator (`components/sync/sync-status-indicator.tsx`)

**Purpose**: Show sync status with an icon.

**Props**:
```tsx
interface Props {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
}
```

**Visual States**:
- ☁️ `synced` - Green cloud
- ⬆️ `syncing` - Blue cloud with upload, animated pulse
- ⚠️ `sync-failed` - Red alert circle
- 🚫 `local-only` - Gray cloud-off

#### SyncProgressModal (`components/sync/sync-progress-modal.tsx`)

**Purpose**: Show bulk sync progress on first login.

**Features**:
- Spinner while syncing
- Success count with checkmark
- Failed count with error icon
- Detailed error messages
- Close button when done

---

### Profile Components

#### ProfileEditModal (`components/profile/profile-edit-modal.tsx`)

**Purpose**: Edit user profile (display name, avatar URL).

**Features**:
- Form with validation
- Loading state
- Error handling
- Cancel/Save buttons
- Optimistic UI update

---

### Leaderboard Components

#### LeaderboardTable (`components/leaderboards/leaderboard-table.tsx`)

**Purpose**: Display ranked leaderboard entries.

**Features**:
- Top 3 get medal icons (🥇🥈🥉)
- Current user highlighted in blue with "(You)" badge
- Avatar images or initials
- Responsive grid layout
- Loading and empty states

#### LeaderboardFilters (`components/leaderboards/leaderboard-filters.tsx`)

**Purpose**: Filter controls for leaderboards.

**Features**:
- Grid size selector with arrows (4×4 to 10×10)
- Order mode toggle (Ascending/Descending)
- Date navigation (daily only, can't go to future)
- Responsive layout

---

## State Management

### Global State (React Context)

**AuthContext**:
- User object
- Tokens
- isAuthenticated flag
- Auth methods

**Why Context?**
- Auth state changes infrequently
- Needed throughout the entire app
- Clean dependency injection

### Local State (Zustand)

**GameStore** (`stores/game-store.ts`):
- Current game state
- Grid, timer, scores
- Triggers sync after game ends

**SyncStore** (`stores/sync-store.ts`):
- Sync queue
- Sync errors
- isSyncing flag
- Sync methods

**Why Zustand?**
- Lightweight (< 1KB)
- No boilerplate
- TypeScript-friendly
- Easy to test

### Persistent State (IndexedDB via Dexie)

**Tables**:
- `sessions` - Training sessions
- `profile` - User preferences and stats

**Why Dexie?**
- Simple async/await API
- TypeScript support
- Versioning and migrations
- Live queries (auto-update UI)

---

## Usage & Testing

### Development Setup

1. **Environment Variables**

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `backend/.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=schulte_db
DB_USER=postgres
DB_PASSWORD=your_password

# AWS Cognito
COGNITO_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id

# App
APP_ENVIRONMENT=dev
DEBUG=true
CORS_ORIGINS=["http://localhost:3000"]
```

2. **Start Backend**

```bash
cd backend
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload
```

3. **Start Frontend**

```bash
cd frontend
npm install
npm run dev
```

### Manual Testing Checklist

#### Authentication Flow

- [ ] Register new account
- [ ] Receive and enter confirmation code
- [ ] Login with credentials
- [ ] Access token in memory (check DevTools)
- [ ] Refresh token in cookie (check DevTools → Application → Cookies)
- [ ] Logout clears tokens
- [ ] Forgot password flow
- [ ] Reset password flow

#### Session Sync Flow

- [ ] Play game while anonymous
- [ ] Session saved locally (check IndexedDB)
- [ ] Login to account
- [ ] Bulk sync modal appears
- [ ] All local sessions synced
- [ ] Play new game while authenticated
- [ ] Session syncs immediately after save
- [ ] Sync status indicator updates
- [ ] Turn off network
- [ ] Play game offline
- [ ] Session marked as "local-only"
- [ ] Turn on network
- [ ] Session auto-syncs in background (60s)

#### Profile Sync Flow

- [ ] Change grid size preference
- [ ] Preference updates locally immediately
- [ ] Preference syncs to backend (500ms delay)
- [ ] Edit profile (display name, avatar)
- [ ] Profile updates reflect in UI
- [ ] Login on different browser
- [ ] Preferences loaded from backend

#### Leaderboards Flow

- [ ] Navigate to leaderboards (authenticated only)
- [ ] View daily leaderboard for today
- [ ] Change grid size filter
- [ ] Change order mode filter
- [ ] Navigate to previous days
- [ ] View all-time leaderboard
- [ ] Current user rank highlighted
- [ ] Empty state for new configurations

#### Error Handling

- [ ] Offline banner shows when disconnected
- [ ] Failed sync shows retry option
- [ ] Invalid credentials show error
- [ ] Expired confirmation code shows error
- [ ] Network failure doesn't crash app
- [ ] Error boundary catches React errors

### Automated Testing

**Frontend Tests** (to be implemented):
```bash
cd frontend
npm run test
```

**Backend Tests**:
```bash
cd backend
poetry run pytest --cov
```

---

## Troubleshooting

### Common Issues

#### Issue: Login succeeds but user is immediately logged out

**Cause**: Refresh token cookie not being set or sent.

**Solutions**:
1. Check CORS settings allow credentials:
   ```python
   # backend/app/main.py
   app.add_middleware(
       CORSMiddleware,
       allow_credentials=True,  # Must be True
       ...
   )
   ```

2. Check API client sends credentials:
   ```typescript
   // frontend/lib/api-client.ts
   fetch(url, {
       credentials: 'include',  // Must be 'include'
       ...
   })
   ```

3. Check cookie settings in browser DevTools → Application → Cookies

---

#### Issue: Sessions not syncing

**Cause**: Multiple possibilities.

**Debug Steps**:
1. Check user is authenticated:
   ```typescript
   const { isAuthenticated } = useAuth();
   console.log('Authenticated:', isAuthenticated);
   ```

2. Check network connectivity:
   ```typescript
   console.log('Online:', navigator.onLine);
   ```

3. Check sync status in IndexedDB (DevTools → Application → IndexedDB)

4. Check browser console for errors

5. Check backend logs for API errors

---

#### Issue: Tokens expire too quickly

**Cause**: System clock mismatch or incorrect expiry calculation.

**Solutions**:
1. Check system time is correct
2. Verify token expiry calculation:
   ```typescript
   // lib/storage.ts
   export function calculateExpiresAt(expiresIn: number): number {
     return Date.now() + expiresIn * 1000;  // expiresIn is in seconds
   }
   ```

---

#### Issue: Preferences not syncing to backend

**Cause**: Debounce not triggering or backend error.

**Debug Steps**:
1. Check user is authenticated (preferences only sync when authenticated)
2. Check console for sync errors
3. Verify backend endpoint works (Postman/curl)
4. Check debounce timeout isn't being cleared prematurely

---

#### Issue: Leaderboards empty

**Cause**: No completed sessions for that configuration, or not authenticated.

**Solutions**:
1. Verify user is authenticated (leaderboards require auth)
2. Complete at least one session for that grid size + order mode
3. Check backend logs for query errors
4. Verify database has leaderboard entries

---

### Debugging Tips

**Frontend Debugging**:
```typescript
// Log auth state
const { user, tokens, isAuthenticated } = useAuth();
console.log('Auth:', { user, hasTokens: !!tokens, isAuthenticated });

// Log sync state
const { syncQueue, syncErrors, isSyncing } = useSync();
console.log('Sync:', { queueSize: syncQueue.size, errors: syncErrors.size, isSyncing });

// Inspect IndexedDB
// DevTools → Application → IndexedDB → SchulteDB
```

**Backend Debugging**:
```bash
# Watch logs in real-time
poetry run uvicorn app.main:app --reload --log-level debug

# Check database
psql -U postgres -d schulte_db
SELECT * FROM users;
SELECT * FROM training_sessions ORDER BY created_at DESC LIMIT 10;
```

**Network Debugging**:
```
# Chrome DevTools → Network tab
# Filter by "XHR" or "Fetch"
# Check request/response headers
# Verify Authorization header present
# Verify cookie sent with requests
```

---

## Conclusion

This integration creates a seamless, offline-first experience with cloud sync, authentication, and social features. The architecture prioritizes:

1. **User Experience**: Instant feedback, graceful degradation, clear status
2. **Data Integrity**: Idempotent operations, retry logic, conflict resolution
3. **Security**: httpOnly cookies, token rotation, XSS protection
4. **Maintainability**: TypeScript types, clear separation of concerns, comprehensive error handling

The app now supports both anonymous users (full offline functionality) and authenticated users (cloud backup + leaderboards), with a smooth transition between modes.

For questions or issues, refer to the troubleshooting section or check the implementation code for detailed examples.

---

**Documentation Version**: 1.0
**Last Updated**: January 2024
**Author**: Claude Code Integration
