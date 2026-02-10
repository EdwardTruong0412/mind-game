# Frontend Design Document

## Overview

The Schulte Table Training App frontend is an offline-first Progressive Web App (PWA) built with Next.js 16 and React 19. It provides customizable Schulte table training for cognitive improvement — focus, reaction speed, and peripheral vision.

The app works entirely without a backend today. All data is stored locally in IndexedDB via Dexie.js. Backend integration (auth, cloud sync, leaderboards) will be layered on top without breaking the offline-first experience.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 16.1.6 | Server components, routing, bundling |
| UI Library | React | 19.2.3 | Component rendering |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | v4 | Utility-first CSS |
| UI Components | shadcn/ui (Button) | - | Accessible base components |
| Animations | Framer Motion | 12.32.0 | Declarative animations |
| State | Zustand | 5.0.11 | Lightweight global state |
| Local DB | Dexie.js | 4.3.0 | IndexedDB wrapper |
| Live Queries | dexie-react-hooks | 4.2.0 | Reactive DB reads |
| Icons | Lucide React | 0.563.0 | SVG icon library |
| CSS Utils | clsx + tailwind-merge | 2.1.1 / 3.4.0 | Conditional class merging |
| IDs | uuid | 13.0.0 | Session identifiers |
| Fonts | Geist Sans + Mono | variable | Typography |

---

## Application Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Next.js App Router                   │
│                                                           │
│  ┌─────────┐   ┌───────────┐   ┌───────────────┐        │
│  │  Home   │   │   Train   │   │    History     │        │
│  │  page   │   │   page    │   │     page       │        │
│  └────┬────┘   └─────┬─────┘   └──────┬────────┘        │
│       │               │                │                  │
│  ┌────┴───────────────┴────────────────┴─────────┐       │
│  │              Custom Hooks Layer                 │       │
│  │  useSettings  useTimer  useLanguage             │       │
│  └────────────────────┬──────────────────────────┘       │
│                       │                                   │
│  ┌────────────────────┴──────────────────────────┐       │
│  │              Zustand Store                      │       │
│  │              (game-store)                       │       │
│  └────────────────────┬──────────────────────────┘       │
│                       │                                   │
│  ┌────────────────────┴──────────────────────────┐       │
│  │              Core Libraries                     │       │
│  │  db.ts  game-logic.ts  i18n.ts  utils.ts       │       │
│  └────────────────────┬──────────────────────────┘       │
│                       │                                   │
│  ┌────────────────────┴──────────────────────────┐       │
│  │              IndexedDB (Dexie.js)               │       │
│  │  sessions table  |  profile table               │       │
│  └───────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

---

## Pages & Routing

### Home Page (`/`)

**Purpose:** Game configuration, stats overview, settings, and help.

**Sections:**

1. **Header** — App title, three icon buttons: Help (`?`), History (clock), Settings (gear)
2. **Stats Cards** — Three cards showing: total sessions, current streak (days), best time for selected grid size
3. **Game Configuration Panel:**
   - **Grid Size Selector** (4-10) — Buttons with color-coded difficulty:
     - Green: 4-5 (Easy)
     - Yellow: 6 (Medium)
     - Orange: 7 (Hard)
     - Red: 8-10 (Extreme)
   - **Time Limit Slider** (30-600 seconds) — Range input with labels
   - **Order Mode Toggle** — Ascending (1→N) or Descending (N→1)
4. **Start Training Button** — Calls `initGame()` then navigates to `/train`

**Modals:**
- **Help Modal** — Explains what a Schulte table is, step-by-step instructions, 4 pro tips. Auto-shown on first visit (when `totalSessions === 0`).
- **Settings Modal** — Language selector (EN/VI with flag icons), theme toggle (Light/Dark/System), three switches: haptic feedback, show hints, fixation dot. "Save as Default" button persists grid size + max time to preferences.

### Train Page (`/train`)

**Purpose:** The active training game screen.

**Layout (top to bottom):**
1. **GameControls** — Home button (always), Pause/Resume (during play), Restart (when not idle)
2. **TimerDisplay** — Elapsed time / max time, color-coded progress bar (green → yellow → red), flashing warning when <10 seconds remain
3. **GameStats** — Current target number, progress counter (N / total), mistake counter
4. **SchulteGrid** — The interactive grid (fills remaining space, centered)
5. **ResultCard** — Overlay shown on completion or timeout

**Behavior:**
- Redirects to home if game status is `idle` (no game initialized)
- First tap on the correct number starts the timer (transitions from `ready` → `playing`)
- Web Worker timer ticks every 10ms for accurate timing
- Pausing freezes the timer and disables grid taps

### History Page (`/history`)

**Purpose:** Browse and review past training sessions.

**Features:**
- Lists last 100 sessions (live query, auto-updates)
- Each row shows: grid size badge, order mode arrow (↑/↓), status badge (green=completed, red=timeout, gray=abandoned), completion time, relative date
- Tap a session to open detail modal showing: full stats (grid, time, accuracy, mistakes), order mode, exact timestamp, delete button
- Empty state: clock icon + prompt to start first session

---

## Data Models

### TrainingSession

Represents one complete training session, from start to finish.

```typescript
interface TrainingSession {
  id?: number;              // Auto-increment primary key (Dexie)
  oderId: string;           // UUID v4 — unique session identifier
  gridSize: number;         // 4-10 (rows and columns)
  maxTime: number;          // Time limit in seconds (30-600)
  orderMode: 'ASC' | 'DESC';
  startedAt: string;        // ISO 8601 timestamp
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'timeout' | 'abandoned';
  completionTimeMs: number; // Actual elapsed time in milliseconds
  mistakes: number;         // Total incorrect taps
  accuracy: number;         // Percentage (0-100)
  tapEvents: TapEvent[];    // Full tap-by-tap telemetry
}
```

**Status values explained:**
- `in_progress` — Game started but not yet finished (should not be saved normally)
- `completed` — User tapped all numbers before time ran out
- `timeout` — Time limit reached before all numbers tapped
- `abandoned` — User navigated away or hit Home during a game

### TapEvent

Records every single tap the user makes during a session. Used for analytics and replay.

```typescript
interface TapEvent {
  cellIndex: number;      // Position in grid array (0 to gridSize²-1)
  expectedValue: number;  // The number the user should have tapped
  tappedValue: number;    // The number the user actually tapped
  correct: boolean;       // Was this tap correct?
  timestampMs: number;    // Milliseconds since game started
}
```

**Why store tap events?** Enables future features: heatmaps, reaction time analysis per cell, mistake pattern detection, session replay, AI difficulty adaptation.

### UserPreferences

User-configurable settings, persisted locally and synced to cloud when logged in.

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;    // Vibration on tap (mobile)
  soundEffects: boolean;      // Audio cues (not yet implemented)
  showHints: boolean;         // Yellow ring on current target number
  showFixationDot: boolean;   // Red dot at grid center (eye anchor)
  defaultGridSize: number;    // Remembered grid size setting (4-10)
  defaultMaxTime: number;     // Remembered time limit (30-600)
}
```

**Defaults:** theme=system, haptic=true, sounds=false, hints=false, fixationDot=true, gridSize=5, maxTime=120

### UserStats

Aggregated statistics calculated from session history. Updated on every session save.

```typescript
interface UserStats {
  totalSessions: number;
  completedSessions: number;
  currentStreak: number;      // Consecutive days with >=1 completed session
  longestStreak: number;
  lastPlayedAt: string | null;
  bestTimes: Record<string, number>;  // e.g., {"5-ASC": 28500, "6-DESC": 45000}
  avgTimes: Record<string, number>;   // Same key format, averaged
}
```

**Key format:** `"${gridSize}-${orderMode}"` — e.g., `"5-ASC"`, `"7-DESC"`

**Streak logic:**
- Playing on the same day as last session: streak unchanged
- Playing the day after last session: streak incremented
- Gap of 2+ days: streak resets to 1
- Only `completed` sessions count toward streaks

### UserProfile

Container for preferences and stats. Single local profile today, will map to authenticated user later.

```typescript
interface UserProfile {
  id: string;               // "local" for offline, Cognito sub when logged in
  createdAt: string;
  preferences: UserPreferences;
  stats: UserStats;
}
```

---

## Game State Machine (Zustand Store)

The game store manages the entire lifecycle of a training session.

### State Shape

```typescript
interface GameState {
  status: 'idle' | 'ready' | 'playing' | 'paused' | 'completed' | 'timeout';
  gridSize: number;
  maxTime: number;
  orderMode: 'ASC' | 'DESC';
  grid: number[];           // Shuffled array of [1..gridSize²]
  currentTarget: number;    // Next number the user must tap
  mistakes: number;
  tapEvents: TapEvent[];
  startTime: number | null; // Date.now() when game started
  elapsedTime: number;      // Milliseconds elapsed
  sessionId: string | null; // UUID for this session
}
```

### State Transitions

```
idle ──initGame()──→ ready ──startGame()──→ playing ──→ completed
                                  │    ↑               ↑
                                  │    │               │
                              pauseGame()          endGame('completed')
                                  │    │               │
                                  ↓    │               │
                                paused──resumeGame()   │
                                                       │
                              playing ──timeout──→ endGame('timeout')
                              playing ──home─────→ endGame('abandoned')

Any state ──resetGame()──→ idle
```

### Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| `initGame(gridSize, maxTime, orderMode)` | User taps "Start Training" | Generates shuffled grid, sets starting target, creates session UUID, status→ready |
| `startGame()` | First correct tap on grid | Records startTime, status→playing |
| `pauseGame()` | Pause button | status→paused, timer stops |
| `resumeGame()` | Resume button | status→playing, timer resumes |
| `handleCellTap(value, cellIndex)` | User taps a grid cell | Creates TapEvent. If correct: advance target, check completion. If incorrect: increment mistakes, 300ms shake animation |
| `updateElapsedTime(time)` | Web Worker tick (every 10ms) | Updates elapsedTime, checks timeout |
| `endGame(reason)` | Completion/timeout/abandon | Calculates accuracy, saves to IndexedDB, updates stats |
| `resetGame()` | Restart or navigate away | Resets all state to initial values |

---

## Core Libraries

### Game Logic (`lib/game-logic.ts`)

| Function | Purpose |
|----------|---------|
| `generateGrid(size)` | Creates [1..size²] array, Fisher-Yates shuffles it |
| `getStartingTarget(gridSize, orderMode)` | ASC→1, DESC→gridSize² |
| `getNextTarget(current, orderMode)` | ASC→current+1, DESC→current-1 |
| `isGameComplete(currentTarget, gridSize, orderMode)` | ASC: target > gridSize², DESC: target < 1 |
| `calculateAccuracy(totalCells, mistakes)` | `(totalCells / (totalCells + mistakes)) * 100` |
| `formatTime(ms)` | Display format: `"1:23.45"` (minutes:seconds.centiseconds) |
| `formatTimeShort(ms)` | Compact format: `"1m23s"` (for history list) |
| `getGridCellSize(gridSize, containerSize)` | Optimal cell pixel size accounting for gaps |
| `isCenterCell(index, gridSize)` | True for the middle cell of odd-sized grids (fixation dot) |
| `triggerHaptic(type)` | Vibration patterns: success=[10,50,10], error=100ms, light=10ms |

### Database (`lib/db.ts`)

**IndexedDB Schema (Dexie):**

```
Database: "SchulteDB"
Version: 1

Table: sessions
  Primary Key: ++id (auto-increment)
  Indexes: oderId, startedAt, gridSize, status

Table: profile
  Primary Key: id (string, always "local")
```

**Operations:**

| Function | Purpose |
|----------|---------|
| `getOrCreateProfile()` | Returns existing profile or creates one with defaults |
| `updatePreferences(partial)` | Merges preference updates into profile |
| `updateStats(partial)` | Merges stat updates into profile |
| `saveSession(session)` | Persists session + auto-recalculates all stats (best times, averages, streaks) |
| `getRecentSessions(limit=50)` | Last N sessions ordered by startedAt DESC |
| `getSessionById(id)` | Single session lookup |
| `deleteSession(id)` | Remove session (does NOT recalculate stats — known limitation) |

**Stats recalculation on save:** When `saveSession()` is called, it:
1. Increments `totalSessions`
2. Increments `completedSessions` if status is `completed`
3. Computes key `"${gridSize}-${orderMode}"`
4. Updates `bestTimes[key]` if new time is lower
5. Queries all completed sessions for this key, recalculates average
6. Updates streak: same-day=keep, next-day=increment, gap=reset to 1
7. Updates `longestStreak` if current exceeds it

### Translations (`lib/i18n.ts`)

**Languages:** English (`en`), Vietnamese (`vi`)

**Coverage:** ~60 translation keys covering all UI text — app name, home page labels, settings, help content (4 pro tips, 3 how-to steps), game UI, result screen, history page.

**Usage:** `getTranslation(lang, key)` with English fallback if key missing.

**Storage:** Language preference stored in `localStorage` (not in UserProfile), managed by `useLanguage`/`useTranslation` hooks.

---

## Custom Hooks

### useTimer()

**Purpose:** Accurate game timer using a Web Worker to avoid main-thread throttling.

**Why a Web Worker?** Browser tabs in the background throttle `setInterval` to 1-second minimum. A Web Worker runs independently and maintains 10ms precision.

**Implementation:** Creates an inline Web Worker from a Blob URL (avoids Next.js static file complications). The worker runs `setInterval(10)` and posts elapsed time back to the main thread.

**Returns:** `{ start, pause, resume, stop }` — lifecycle controls linked to the game store.

### useSettings()

**Purpose:** Provides reactive access to user preferences and stats from IndexedDB.

**Implementation:** Uses `useLiveQuery` from dexie-react-hooks for real-time updates. Any write to the profile table automatically re-renders components using this hook.

**Returns:** `{ preferences, stats, isLoading, updateSetting(key, value) }`

### useTheme()

**Purpose:** Manages light/dark/system theme with system preference detection.

**Implementation:**
- Reads user preference from profile
- Detects system preference via `matchMedia('(prefers-color-scheme: dark)')`
- Toggles `dark` class on `<html>` element (Tailwind dark mode strategy)
- Listens to system theme changes in real-time

**Returns:** `{ theme, resolvedTheme, setTheme }`

### useLanguage() / useTranslation()

**Purpose:** Language selection and translation lookup.

**Implementation:** Persists language choice to `localStorage`. Provides `t(key)` function for translations. `useTranslation` is the standalone version with `isLoaded` flag for SSR hydration safety.

**Returns:** `{ language, setLanguage, t, isLoaded }`

---

## Components

### SchulteGrid

The core interactive grid where the user taps numbers.

**Behavior:**
- Dynamically renders gridSize × gridSize cells using CSS Grid
- Staggered mount animation (20ms delay per cell, 0.2s scale+opacity via Framer Motion)
- Cell states: `default` (neutral), `correct` (green flash), `incorrect` (red flash + shake), `completed` (greyed out, disabled)
- First correct tap auto-starts the game (`ready` → `playing`)
- Fixation dot: small red circle at grid center (odd-sized grids only, toggleable)
- Hint mode: yellow ring highlights the current target number
- Haptic feedback on every tap (if enabled)
- Touch-optimized: `touch-action: manipulation` prevents zoom/scroll

### TimerDisplay

Shows elapsed time and remaining time with visual urgency cues.

**Behavior:**
- Format: `elapsed / maxTime` (e.g., "0:45.23 / 2:00.00")
- Progress bar below, color transitions: green (<50%) → yellow (50-80%) → red (>80%)
- Low-time warning: bar flashes red when <10 seconds remain and game is playing

### GameStats

Displays current game progress metrics.

**Behavior:**
- Shows target icon + "Find: N" or "Next: N" depending on state
- Progress: "12 / 25" (tapped / total cells)
- Mistakes counter with X icon

### GameControls

Navigation and game flow buttons.

**Behavior:**
- **Home**: Always visible. If game is playing/paused, calls `endGame('abandoned')` before navigating.
- **Pause/Resume**: Only during playing/paused states. Toggles timer and grid interaction.
- **Restart**: Visible when not idle. Calls `resetGame()` then `initGame()` with same settings.

### ResultCard

Overlay modal shown when a game ends (completed or timeout).

**Behavior:**
- **Completed**: Trophy icon, green theme, shows time/accuracy/grid/mistakes
- **Timeout**: Clock icon, amber theme, same stats layout
- Compares current time against personal best for this grid+order combo
- Shows "New Best!" badge if applicable
- Two actions: "Home" and "Play Again"

---

## PWA Configuration

```json
{
  "name": "Schulte Table Training",
  "short_name": "Schulte",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f8fafc",
  "theme_color": "#3b82f6",
  "start_url": "/",
  "icons": ["192x192", "512x512"]
}
```

**Features:**
- Installable on mobile (Add to Home Screen)
- Standalone display (no browser chrome)
- Portrait orientation locked
- Safe area insets for notched devices (iPhone)
- Apple Web App meta tags for iOS

**Limitations:** No service worker caching yet — the app requires network for initial load but works offline for gameplay once loaded.

---

## Theming

**Strategy:** Tailwind CSS dark mode via `class` on `<html>`.

**CSS Variables:**
```css
:root {
  --background: #f8fafc;  /* slate-50 */
  --foreground: #0f172a;  /* slate-900 */
}
.dark {
  --background: #0f172a;  /* slate-900 */
  --foreground: #f1f5f9;  /* slate-100 */
}
```

**System detection:** `matchMedia('(prefers-color-scheme: dark)')` with real-time listener for OS theme changes.

---

## Future Backend Integration Points

When the backend is ready, the frontend will need these additions:

1. **Auth Context/Provider** — Wrap app with auth state (logged in/out, user info, tokens)
2. **API Client** — HTTP client with JWT token injection, refresh logic, error handling
3. **Session Sync** — After `saveSession()`, also POST to `/api/v1/sessions`. Queue failed syncs for retry.
4. **Bulk Sync** — On login, POST all unsynced local sessions to `/api/v1/sessions/sync`
5. **Preferences Sync** — On preference change, PATCH `/api/v1/users/me/preferences`
6. **Leaderboard UI** — New page or tab showing daily/all-time rankings
7. **Login/Register Pages** — Cognito-integrated auth flows (email + Google + Apple)
8. **Profile Page** — Display name, avatar, cloud-synced stats

**Principle:** All these additions are non-breaking. The app continues to work fully offline. Sync happens in the background. Server data supplements local data, never replaces it.
