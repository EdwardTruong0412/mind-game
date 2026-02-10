# Backend Design Document

## Overview

The backend is a FastAPI application that provides authentication, cloud sync, leaderboards, and server-side stats for the Schulte Table Training App. It runs on a single EC2 instance behind CloudFlare, connects to RDS PostgreSQL, and uses AWS Cognito for user authentication.

The backend is designed to be a thin, stateless API layer. There is no Redis cache, no message queue, no background workers — just FastAPI talking to PostgreSQL. This keeps cost at $0 within AWS free tier.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | FastAPI (async) | API framework with auto-generated OpenAPI docs |
| Language | Python 3.11+ | Modern typing, async/await |
| ORM | SQLAlchemy 2.0 (async) | Database access with type hints |
| Migrations | Alembic | Database schema versioning |
| Validation | Pydantic v2 | Request/response schema validation |
| Auth | AWS Cognito + python-jose | Managed auth + JWT validation |
| DB Driver | asyncpg | Async PostgreSQL driver |
| HTTP Client | httpx | Async HTTP for Cognito API calls |
| Logging | structlog | Structured JSON logging |
| AWS SDK | boto3 | SSM parameter retrieval, Cognito admin calls |
| Config | pydantic-settings | Environment-based config with validation |
| Linting | Ruff | Fast Python linter (replaces flake8/black/isort) |
| Type Check | mypy (strict) | Static type analysis |
| Testing | pytest + pytest-asyncio | Async test support |

---

## Architecture

```
                   CloudFlare (HTTPS + DNS)
                          │
                          ▼
              ┌─────────────────────┐
              │  EC2 t2.micro       │
              │  ┌───────────────┐  │
              │  │  Docker       │  │
              │  │  ┌─────────┐  │  │
              │  │  │ FastAPI │  │  │
              │  │  │ :8000   │  │  │
              │  │  └────┬────┘  │  │
              │  └───────┼───────┘  │
              └──────────┼──────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌────────────┐ ┌─────────┐ ┌─────────┐
     │ RDS        │ │ Cognito │ │ SSM     │
     │ PostgreSQL │ │ (auth)  │ │ (secrets│
     │ :5432      │ │         │ │  store) │
     └────────────┘ └─────────┘ └─────────┘
```

**Request flow:**
1. User → CloudFlare (terminates HTTPS) → EC2 port 80
2. FastAPI validates JWT from Cognito
3. FastAPI queries/writes PostgreSQL
4. Response returned to user

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry, lifespan, middleware, CORS
│   ├── config.py               # Settings from environment/SSM
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependency injection (DB session, current user)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       # Aggregates all v1 routers
│   │       ├── auth.py         # Auth endpoints (register, login, etc.)
│   │       ├── users.py        # User profile endpoints
│   │       ├── sessions.py     # Training session CRUD + sync
│   │       └── leaderboards.py # Leaderboard queries
│   │
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── session.py
│   │   └── leaderboard.py
│   │
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── common.py           # Shared schemas (pagination, API response)
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── session.py
│   │   └── leaderboard.py
│   │
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth.py             # Cognito interaction logic
│   │   ├── session.py          # Session save + stats update logic
│   │   ├── leaderboard.py      # Leaderboard query + update logic
│   │   └── stats.py            # Stats aggregation logic
│   │
│   ├── repositories/           # Data access layer (raw SQL/ORM queries)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── session.py
│   │   └── leaderboard.py
│   │
│   └── core/
│       ├── __init__.py
│       ├── database.py         # Async SQLAlchemy engine + session factory
│       ├── security.py         # JWT validation (Cognito JWKS)
│       └── exceptions.py       # Custom HTTP exceptions
│
├── alembic/                    # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/               # Migration files
│
├── tests/
│   ├── conftest.py             # Fixtures (test DB, test client, auth mock)
│   ├── test_auth.py
│   ├── test_sessions.py
│   ├── test_leaderboards.py
│   └── test_users.py
│
├── Dockerfile
├── docker-compose.yml          # Local dev (PostgreSQL + LocalStack)
├── pyproject.toml              # Dependencies + tool config
├── alembic.ini
└── .env.example
```

**Layer responsibilities:**
- **api/** — HTTP layer: parse requests, call services, return responses
- **services/** — Business logic: orchestrate operations, enforce rules
- **repositories/** — Data access: SQL queries, ORM operations
- **models/** — Database table definitions
- **schemas/** — Request/response shapes and validation
- **core/** — Infrastructure: DB connection, auth, error handling

---

## API Endpoints

### Health Check

```
GET /health
```

**Purpose:** Verify the application is running and can connect to the database.

**Response:** `{"status": "healthy", "database": "connected"}`

**Logic:** Executes `SELECT 1` against PostgreSQL. Returns 503 if database is unreachable. Used by Docker health check and monitoring.

---

### Authentication (`/api/v1/auth`)

All auth endpoints are thin proxies to AWS Cognito. The backend does NOT store passwords.

#### POST `/api/v1/auth/register`

**Purpose:** Create a new user account.

**Flow:**
1. Receive email, password, display_name from client
2. Call Cognito `SignUp` API (creates user in Cognito user pool)
3. Create a `users` row in PostgreSQL (cognito_sub, email, display_name, default preferences)
4. Return success message (user must verify email)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1",
  "display_name": "Player One"
}
```

**Validation:**
- Email: valid format
- Password: min 8 chars, requires uppercase + lowercase + number (matches Cognito policy)
- Display name: 1-100 characters

**Error cases:**
- Email already registered → 409 Conflict
- Password too weak → 400 Bad Request
- Cognito service error → 502 Bad Gateway

#### POST `/api/v1/auth/confirm`

**Purpose:** Verify email address with the code Cognito sent.

**Flow:**
1. Receive email + confirmation_code
2. Call Cognito `ConfirmSignUp` API
3. Return success

**Request:**
```json
{
  "email": "user@example.com",
  "confirmation_code": "123456"
}
```

**Error cases:**
- Invalid/expired code → 400
- Already confirmed → 400

#### POST `/api/v1/auth/login`

**Purpose:** Authenticate user and return JWT tokens.

**Flow:**
1. Receive email + password
2. Call Cognito `InitiateAuth` (USER_PASSWORD_AUTH flow)
3. Cognito returns AccessToken, IdToken, RefreshToken
4. Return all three tokens to client

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Error cases:**
- Wrong credentials → 401 Unauthorized
- Email not confirmed → 403 Forbidden
- Account disabled → 403

#### POST `/api/v1/auth/refresh`

**Purpose:** Get new access/id tokens using a refresh token.

**Flow:**
1. Receive refresh_token
2. Call Cognito `InitiateAuth` (REFRESH_TOKEN_AUTH flow)
3. Return new access + id tokens

**Why needed:** Access tokens expire after 1 hour. The frontend calls this automatically before expiry to maintain the session seamlessly.

#### POST `/api/v1/auth/logout`

**Purpose:** Invalidate the user's refresh token (server-side logout).

**Flow:**
1. Receive refresh_token (or use access token from Authorization header)
2. Call Cognito `GlobalSignOut` or `RevokeToken`
3. Return success

**Why needed:** Prevents the refresh token from being used to get new access tokens. Important for security when a user explicitly logs out.

#### POST `/api/v1/auth/forgot-password`

**Purpose:** Initiate password reset flow.

**Flow:**
1. Receive email
2. Call Cognito `ForgotPassword` API
3. Cognito sends a verification code to the email
4. Return success (always, even if email doesn't exist — prevents enumeration)

#### POST `/api/v1/auth/reset-password`

**Purpose:** Complete password reset with verification code.

**Flow:**
1. Receive email, confirmation_code, new_password
2. Call Cognito `ConfirmForgotPassword` API
3. Return success

#### POST `/api/v1/auth/social/google`

**Purpose:** Authenticate via Google OAuth.

**Flow:**
1. Frontend redirects user to Cognito Hosted UI with Google identity provider
2. User authenticates with Google
3. Cognito redirects back to frontend callback URL with authorization code
4. Frontend sends authorization code to this endpoint
5. Backend exchanges code for tokens via Cognito token endpoint
6. If this is a new user (no DB row), create user row from Cognito attributes
7. Return JWT tokens

**Why this flow?** Cognito handles the OAuth complexity (token exchange, profile fetching). The backend just needs to exchange the authorization code and ensure a local user record exists.

#### POST `/api/v1/auth/social/apple`

**Purpose:** Authenticate via Apple Sign In. Same flow as Google but with Apple as the identity provider.

**Note:** Apple requires additional setup: Apple Developer account, Service ID, private key. The Cognito user pool must be configured with Apple as an identity provider (requires updating Terraform auth module).

---

### Users (`/api/v1/users`)

All user endpoints require authentication (JWT in `Authorization: Bearer <token>` header).

#### GET `/api/v1/users/me`

**Purpose:** Get the current user's complete profile including preferences and stats.

**Flow:**
1. Extract user ID from JWT token (Cognito `sub` claim)
2. Query `users` table for profile data
3. Query `user_stats` table for aggregated stats
4. Return combined profile

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Player One",
  "avatar_url": null,
  "preferences": {
    "theme": "system",
    "hapticFeedback": true,
    "soundEffects": false,
    "showHints": false,
    "showFixationDot": true,
    "defaultGridSize": 5,
    "defaultMaxTime": 120
  },
  "stats": {
    "totalSessions": 42,
    "completedSessions": 38,
    "currentStreak": 5,
    "longestStreak": 12,
    "lastPlayedAt": "2025-01-15T10:30:00Z",
    "bestTimes": {"5-ASC": 28500, "6-ASC": 45000},
    "avgTimes": {"5-ASC": 32000, "6-ASC": 52000}
  },
  "created_at": "2024-12-01T00:00:00Z"
}
```

**Why combine profile + stats?** One API call on login gives the frontend everything it needs to hydrate the UI. Avoids waterfall requests.

#### PATCH `/api/v1/users/me`

**Purpose:** Update profile fields (display name, avatar URL).

**Request:**
```json
{
  "display_name": "New Name",
  "avatar_url": "https://..."
}
```

**Validation:**
- display_name: 1-100 characters, no special control characters
- avatar_url: valid URL format, max 500 characters

#### PATCH `/api/v1/users/me/preferences`

**Purpose:** Update user preferences (partial update — only send changed fields).

**Request:**
```json
{
  "theme": "dark",
  "defaultGridSize": 7
}
```

**Flow:**
1. Read current preferences JSONB from user row
2. Merge incoming fields (shallow merge)
3. Write back merged JSONB
4. Return updated preferences

**Why JSONB?** Preferences are a flexible bag of settings. Using JSONB avoids schema migrations when adding new preference fields. The Pydantic schema validates the shape on input.

#### GET `/api/v1/users/{user_id}`

**Purpose:** Get a public profile (for leaderboard user clicks).

**Response:** Only public fields: id, display_name, avatar_url, created_at. No email, no preferences, no detailed stats.

---

### Sessions (`/api/v1/sessions`)

All session endpoints require authentication.

#### POST `/api/v1/sessions`

**Purpose:** Save a single training session to the cloud.

**Flow:**
1. Validate session data (grid_size 4-10, max_time 30-600, valid status, etc.)
2. Check for duplicate by `client_session_id` (the frontend's `oderId` UUID) — idempotent
3. Insert into `training_sessions` table
4. If status is `completed`: update `daily_leaderboards` and `user_stats`
5. Return saved session with server-generated ID

**Request:**
```json
{
  "client_session_id": "uuid-from-frontend",
  "grid_size": 5,
  "max_time": 120,
  "order_mode": "ASC",
  "status": "completed",
  "completion_time_ms": 28500,
  "mistakes": 3,
  "accuracy": 89.29,
  "tap_events": [
    {
      "cell_index": 12,
      "expected_value": 1,
      "tapped_value": 1,
      "correct": true,
      "timestamp_ms": 450
    }
  ],
  "started_at": "2025-01-15T10:30:00Z",
  "completed_at": "2025-01-15T10:30:28.500Z"
}
```

**Idempotency:** The `client_session_id` (frontend's UUID) prevents duplicate saves. If the frontend retries a failed sync, the server recognizes the UUID and returns the existing session instead of creating a duplicate.

**Stats update logic (on completed sessions):**

1. **User stats:**
   - Increment `total_sessions`, `completed_sessions`
   - Update `best_times[key]` if new time is lower
   - Recalculate `avg_times[key]` from all completed sessions for this config
   - Update streak (same-day/next-day/gap logic)
   - Set `last_played_at`

2. **Daily leaderboard:**
   - Check if user already has an entry for today + grid_size + order_mode
   - If no entry: insert new row
   - If existing entry but new time is better: update

#### GET `/api/v1/sessions`

**Purpose:** List the current user's training sessions with pagination and filtering.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page (max 100) |
| `grid_size` | int? | - | Filter by grid size |
| `order_mode` | string? | - | Filter by ASC/DESC |
| `status` | string? | - | Filter by status |
| `sort_by` | string | started_at | Sort field |
| `sort_dir` | string | desc | Sort direction |

**Response:**
```json
{
  "data": [ /* array of sessions (without tap_events for list view) */ ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**Why exclude tap_events from list?** Tap events can be large (100+ entries per session for a 10x10 grid). The list endpoint returns lightweight summaries. Use the detail endpoint to get full tap data.

#### GET `/api/v1/sessions/{session_id}`

**Purpose:** Get full session details including tap events.

**Authorization:** Only the session owner can access their sessions.

**Response:** Complete session object including `tap_events[]`.

#### DELETE `/api/v1/sessions/{session_id}`

**Purpose:** Delete a training session.

**Flow:**
1. Verify session belongs to current user
2. Delete from `training_sessions`
3. Recalculate `user_stats` (best times, averages, totals)
4. Remove from `daily_leaderboards` if it was the best time for that day
5. Return 204 No Content

**Why recalculate stats?** Unlike the frontend (which has a known bug of not recalculating on delete), the backend keeps stats consistent.

#### POST `/api/v1/sessions/sync`

**Purpose:** Bulk upload multiple sessions from offline play. Called when user logs in with unsynced local sessions.

**Flow:**
1. Receive array of sessions (max 100 per request)
2. For each session: check duplicate by `client_session_id`, insert if new
3. Recalculate all stats once after batch insert (efficient)
4. Return summary: `{ synced: 15, skipped: 3 (duplicates) }`

**Request:**
```json
{
  "sessions": [
    { /* same shape as POST /sessions */ },
    { /* ... */ }
  ]
}
```

**Why batch?** A user who played 50 sessions offline shouldn't trigger 50 individual API calls. One batch call is faster and more reliable.

---

### Leaderboards (`/api/v1/leaderboards`)

Leaderboard endpoints are publicly readable (no auth required) but authenticated users get their own rank highlighted.

#### GET `/api/v1/leaderboards/daily`

**Purpose:** Today's best times, ranked by fastest completion.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `grid_size` | int | 5 | Grid size to show |
| `order_mode` | string | ASC | Order mode to show |
| `limit` | int | 50 | Max entries |
| `offset` | int | 0 | Pagination offset |

**Response:**
```json
{
  "data": [
    {
      "rank": 1,
      "user_id": "uuid",
      "display_name": "SpeedRunner",
      "best_time_ms": 18500,
      "date": "2025-01-15"
    }
  ],
  "meta": {
    "grid_size": 5,
    "order_mode": "ASC",
    "date": "2025-01-15",
    "total_entries": 42
  },
  "current_user": {
    "rank": 7,
    "best_time_ms": 28500
  }
}
```

**Logic:**
1. Query `daily_leaderboards` table for today's date, filtered by grid_size + order_mode
2. Order by `best_time_ms ASC` (fastest first)
3. If authenticated, also query current user's rank

**Why a denormalized table?** Querying "best time per user per day" from the sessions table requires `GROUP BY` + `MIN()` which gets slow at scale. The `daily_leaderboards` table stores pre-computed best times, making reads instant.

#### GET `/api/v1/leaderboards/daily/{date}`

**Purpose:** Same as daily but for a specific past date (format: `YYYY-MM-DD`).

**Use case:** "How did I rank last Tuesday?"

#### GET `/api/v1/leaderboards/all-time`

**Purpose:** All-time best times across all dates.

**Query parameters:** Same as daily (grid_size, order_mode, limit, offset).

**Logic:** Query `daily_leaderboards` grouped by user, taking `MIN(best_time_ms)`. This finds each user's absolute best time ever.

**Response shape:** Same as daily leaderboard.

---

## Database Schema

### users

Stores user profile data. Linked to Cognito via `cognito_sub`.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,   -- Cognito user ID
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',             -- Flexible settings bag
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX idx_users_email ON users(email);
```

**Why UUID primary key?** Avoids leaking information (sequential IDs reveal user count). UUIDs are safe to expose in URLs and API responses.

**Why JSONB for preferences?** Avoids schema migrations when adding new settings. Validated by Pydantic on the application layer.

### training_sessions

Stores every training session with full tap telemetry.

```sql
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_session_id VARCHAR(255) NOT NULL,     -- Frontend's oderId UUID
    grid_size INTEGER NOT NULL,
    max_time INTEGER NOT NULL,
    order_mode VARCHAR(10) NOT NULL,             -- ASC or DESC
    status VARCHAR(20) NOT NULL,                 -- completed, timeout, abandoned
    completion_time_ms INTEGER,
    mistakes INTEGER DEFAULT 0,
    accuracy FLOAT,
    tap_events JSONB,                            -- Array of TapEvent objects
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, client_session_id)           -- Idempotency constraint
);

CREATE INDEX idx_sessions_user ON training_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_leaderboard
    ON training_sessions(grid_size, order_mode, status, completion_time_ms)
    WHERE status = 'completed';
```

**Why JSONB for tap_events?** Tap events are write-once telemetry data. We never query individual taps via SQL. Storing as JSONB keeps the schema simple and avoids a separate table with millions of rows.

**Idempotency constraint:** `UNIQUE(user_id, client_session_id)` ensures the same session can't be saved twice, even if the frontend retries the sync request.

### daily_leaderboards

Denormalized table for fast leaderboard reads. Updated automatically when sessions are saved.

```sql
CREATE TABLE daily_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    grid_size INTEGER NOT NULL,
    order_mode VARCHAR(10) NOT NULL,
    best_time_ms INTEGER NOT NULL,
    date DATE NOT NULL,

    UNIQUE(user_id, grid_size, order_mode, date)
);

CREATE INDEX idx_daily_ranking
    ON daily_leaderboards(date, grid_size, order_mode, best_time_ms);
```

**Update logic:** When a completed session is saved:
- If no entry exists for this user+grid+order+today → INSERT
- If entry exists but new time is faster → UPDATE with new time + session_id
- If entry exists and new time is slower → no change

### user_stats

Denormalized aggregated statistics per user. Avoids expensive `COUNT`/`AVG`/`MIN` queries on the sessions table.

```sql
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_sessions INTEGER DEFAULT 0,
    completed_sessions INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_played_at TIMESTAMPTZ,
    best_times JSONB DEFAULT '{}',    -- {"5-ASC": 28500, "6-DESC": 45000}
    avg_times JSONB DEFAULT '{}',     -- Same key format
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why denormalize?** The `GET /users/me` endpoint is called on every app open. Computing stats from scratch (`SELECT COUNT(*), MIN(completion_time_ms), ... FROM training_sessions GROUP BY ...`) would be slow at scale. Pre-computed stats make reads O(1).

**Update logic:** Stats are recalculated on:
- Session save (increment counts, update best/avg times, update streak)
- Session delete (full recalculation of affected keys)
- Bulk sync (single recalculation after all inserts)

---

## Authentication Flow

### JWT Validation

Every protected endpoint validates the JWT token:

1. Extract `Authorization: Bearer <token>` header
2. Decode JWT header to get `kid` (key ID)
3. Fetch Cognito JWKS (JSON Web Key Set) from `https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json`
4. Cache JWKS in memory (refresh every 24 hours)
5. Validate token signature using the matching public key
6. Verify claims: `iss` (issuer), `aud` (audience/client_id), `exp` (expiration), `token_use` (access)
7. Extract `sub` claim as the user's Cognito ID
8. Look up user in PostgreSQL by `cognito_sub`

**Why validate in the backend?** Even though Cognito handles login, the backend must verify every request independently. Tokens could be expired, revoked, or forged.

### Social Login (Google + Apple)

Social login uses Cognito as the identity broker:

```
User → Frontend → Cognito Hosted UI → Google/Apple
                                            │
                                   (user authenticates)
                                            │
                         Cognito ← authorization code ←┘
                              │
                    (exchanges for tokens)
                              │
                  Frontend ← redirect with code
                              │
                  Backend ← authorization code
                              │
                    (exchanges code for JWT tokens via Cognito)
                              │
                    (creates user row if new)
                              │
                  Frontend ← JWT tokens
```

**Cognito handles:**
- OAuth redirect flows
- Token exchange with Google/Apple
- Profile attribute mapping (email, name)
- Linking social accounts to Cognito user pool entries

**Backend handles:**
- Exchanging Cognito authorization code for tokens
- Creating local user row if this is the first login
- Returning JWT tokens to the frontend

---

## Business Logic Details

### Accuracy Calculation

```
accuracy = (totalCells / (totalCells + mistakes)) * 100
```

Where `totalCells = gridSize * gridSize`. A 5x5 grid with 3 mistakes: `(25 / 28) * 100 = 89.29%`.

**Note:** This formula counts every tap (correct + incorrect). A game with 25 cells and 0 mistakes = 100%. A game with 25 cells and 25 mistakes = 50%.

### Streak Calculation

Streaks track consecutive days where the user completed at least one session.

```python
def update_streak(last_played_at: datetime | None, current_streak: int) -> tuple[int, bool]:
    today = datetime.now(UTC).date()

    if last_played_at is None:
        return 1, False  # First ever session

    last_date = last_played_at.date()
    days_diff = (today - last_date).days

    if days_diff == 0:
        return current_streak, False   # Same day, no change
    elif days_diff == 1:
        return current_streak + 1, True  # Next day, extend streak
    else:
        return 1, False  # Gap, reset to 1
```

**Edge cases:**
- Multiple sessions on the same day: streak stays the same
- Playing at 11:59 PM and 12:01 AM: counts as consecutive days
- Timezone: server uses UTC. Future enhancement could use user's timezone.

### Best/Avg Times

Times are keyed by `"${gridSize}-${orderMode}"` (e.g., `"5-ASC"`, `"7-DESC"`).

**Best time update:**
```python
key = f"{session.grid_size}-{session.order_mode}"
if key not in best_times or session.completion_time_ms < best_times[key]:
    best_times[key] = session.completion_time_ms
```

**Average time update:**
```python
# Query all completed sessions for this user + key
completed = await repo.get_completed_sessions(user_id, grid_size, order_mode)
avg = sum(s.completion_time_ms for s in completed) / len(completed)
avg_times[key] = round(avg)
```

**Only `completed` sessions** count for best/avg times. Timeouts and abandoned sessions are excluded.

### Leaderboard Update

When a completed session is saved:

```python
today = date.today()
existing = await repo.get_daily_entry(user_id, grid_size, order_mode, today)

if existing is None:
    # First completed session today for this config
    await repo.create_daily_entry(user_id, session_id, grid_size, order_mode, time_ms, today)
elif time_ms < existing.best_time_ms:
    # New personal best for today
    await repo.update_daily_entry(existing.id, session_id, time_ms)
# else: existing time is better, no update
```

---

## Configuration

Settings loaded from environment variables with Pydantic validation:

```python
class Settings(BaseSettings):
    # App
    environment: str = "dev"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    db_host: str
    db_port: int = 5432
    db_name: str = "schulte"
    db_username: str
    db_password: str       # Retrieved from SSM at startup

    # Cognito
    cognito_user_pool_id: str
    cognito_client_id: str
    cognito_region: str = "ap-southeast-1"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_username}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cognito_issuer(self) -> str:
        return f"https://cognito-idp.{self.cognito_region}.amazonaws.com/{self.cognito_user_pool_id}"
```

**DB password retrieval:** On startup, the app reads the password from SSM Parameter Store using boto3. This avoids storing secrets in environment files or Terraform state.

---

## Error Handling

### Standard API Response Format

**Success:**
```json
{
  "data": { ... },
  "meta": { ... }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Grid size must be between 4 and 10",
    "details": { ... }
  }
}
```

### Error Codes

| HTTP Status | Error Code | When |
|-------------|-----------|------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | Email not confirmed, account disabled |
| 404 | NOT_FOUND | Resource doesn't exist |
| 409 | CONFLICT | Email already registered, duplicate session |
| 422 | UNPROCESSABLE_ENTITY | Valid format but invalid business logic |
| 502 | BAD_GATEWAY | Cognito service error |
| 503 | SERVICE_UNAVAILABLE | Database unreachable |

---

## CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",       # Local dev
        "https://schulte-app.com",     # Production (update with actual domain)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## Docker Setup

### Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev --no-root
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml (Local Development)

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres]

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: schulte
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: schulte
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

volumes:
  postgres_data:
```

**No Redis, no LocalStack** — keeping local dev simple. Cognito calls can be mocked in tests.

---

## Testing Strategy

| Test Type | Tool | Coverage |
|-----------|------|----------|
| Unit tests | pytest | Services, business logic, stats calculation |
| Integration tests | pytest + async test DB | API endpoints, database operations |
| Auth mocking | pytest fixtures | Mock Cognito JWT validation for test requests |

**Test database:** Uses a separate PostgreSQL database (or SQLite for speed). Alembic migrations run before test suite. Each test runs in a transaction that rolls back.

**Auth mocking:** A fixture overrides the `get_current_user` dependency to return a test user without actually validating JWTs. This lets tests focus on business logic, not auth.

---

## Deployment

The backend runs as a Docker container on EC2:

1. Build Docker image locally or in CI
2. Push to EC2 via `docker save` + `scp` (or future: ECR)
3. On EC2: `docker compose up -d`
4. Alembic migrations run on startup (or manually before deploy)
5. CloudFlare proxies HTTPS traffic to EC2 port 80
6. Docker maps port 80 → container port 8000

**No CI/CD pipeline yet** — manual deploys for MVP. GitHub Actions can be added later.
