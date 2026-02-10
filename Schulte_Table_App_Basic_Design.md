
# Schulte Table Training App – Full-Stack Design Document

## I. Project Objectives (Business Goals)

### Problem Statement
Users lack simple yet customizable tools to train focus, reaction speed, and peripheral vision. Existing apps are often rigid, offer limited customization, and provide little performance insight.

### App Goals
- Allow users to **customize Schulte table training**
- Track **cognitive performance over time**
- Be **fast, lightweight, and suitable for daily use**
- **Sync progress across devices** via cloud
- **Compare performance** with global leaderboards

---

## II. Scope

### Version 1.0 – MVP (Offline-First)
- Schulte number tables (5×5, 6×6, 7×7)
- Training configuration (grid size, time, order mode)
- Automatic timer (Web Worker-based)
- Result evaluation with metrics
- Local history storage (IndexedDB)
- PWA support (installable, offline-first)
- Dark/Light theme
- Haptic feedback

### Version 2.0 – Cloud Integration
- User authentication (email, Google, Apple)
- Cloud sync for sessions and preferences
- Global and friends leaderboards
- Daily challenges with rankings
- Backend API (Python/FastAPI)
- AWS infrastructure

### Version 3.0 – Advanced Features
- AI-based difficulty adaptation
- Cognitive analytics dashboard
- Social features (follow, challenge friends)
- Premium tier with advanced stats

---

## III. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (PWA)                                  │
│                         Next.js 14 + TypeScript                             │
│                      Hosted on Vercel / CloudFront                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS API GATEWAY                                   │
│                    (REST API + Rate Limiting + WAF)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
              ┌─────────────────────┐   ┌─────────────────────┐
              │   AWS COGNITO       │   │   AWS LAMBDA        │
              │   (Authentication)  │   │   (Authorizer)      │
              └─────────────────────┘   └─────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AWS ECS FARGATE CLUSTER                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ API Service │  │ API Service │  │ API Service │  (Auto-scaling)  │   │
│  │  │  (FastAPI)  │  │  (FastAPI)  │  │  (FastAPI)  │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │   RDS POSTGRES  │ │  ELASTICACHE    │ │    S3 BUCKET    │
          │   (Primary DB)  │ │  (Redis Cache)  │ │  (Assets/Logs)  │
          └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## IV. User Personas

### Primary Persona
**Knowledge Worker / Researcher / Developer**
- Age: 25–40
- High cognitive workload
- Needs a quick "brain warm-up" (3–5 minutes daily)

### Usage Pattern
- Open app → train quickly → close app
- Cares about: completion time, progress over time, ranking

---

## V. User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GUEST FLOW (v1.0)                        │
└─────────────────────────────────────────────────────────────────┘
Launch App → Configure → Train → Results → Save Locally → History

┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED FLOW (v2.0)                    │
└─────────────────────────────────────────────────────────────────┘
Launch App → Sign In (Cognito)
    ↓
Sync Local Data to Cloud
    ↓
Configure → Train → Results
    ↓
Save to Cloud + Update Leaderboard
    ↓
View Global Rankings / Friends Comparison
```

---

## VI. Functional Requirements

### 1. Settings Screen
| Field | Type | Description |
|-------|------|-------------|
| Grid Size | Dropdown | 5×5, 6×6, 7×7 |
| Max Time | Slider | Seconds (30–300) |
| Order Mode | Toggle | Ascending / Descending |
| Show Hint | Toggle | Highlight next number |
| Center Fixation Dot | Toggle | Eye anchor point |
| Theme | Toggle | Light / Dark / System |
| Haptic Feedback | Toggle | Vibration on tap |
| Sound Effects | Toggle | Audio cues |

### 2. Schulte Board Logic
- Generate numbers 1 → N²
- Fisher-Yates shuffle
- Responsive CSS Grid
- Center fixation dot (toggleable)

### 3. Interaction Rules
- Correct tap: green highlight, progress, optional vibration
- Incorrect tap: red flash, no progress, mistake counter

### 4. Timer Logic
- Web Worker-based (prevents throttling)
- Starts on first correct tap
- Pause/Resume functionality

### 5. Result Evaluation
| Metric | Description |
|--------|-------------|
| Completion Time | Milliseconds precision |
| Accuracy | `(cells - mistakes) / cells * 100` |
| Status | Completed / Timeout / Abandoned |
| Percentile | Global ranking (v2.0) |

### 6. Authentication (v2.0)
- Email/password registration
- Social login (Google, Apple)
- JWT token management
- Password reset flow

### 7. Leaderboards (v2.0)
| Leaderboard | Scope |
|-------------|-------|
| Global Daily | Best time today per grid size |
| Global All-Time | Best time ever per grid size |
| Weekly Challenge | Fixed seed, everyone plays same grid |
| Friends | Compare with followed users |

---

## VII. Data Models

### Frontend (TypeScript + IndexedDB)

```typescript
interface TrainingSession {
  id: string;
  userId?: string;              // null for guest
  gridSize: number;
  maxTime: number;
  orderMode: 'ASC' | 'DESC';
  startedAt: string;
  completedAt: string | null;
  status: 'completed' | 'timeout' | 'abandoned';
  completionTimeMs: number;
  mistakes: number;
  accuracy: number;
  tapEvents: TapEvent[];
  syncedAt?: string;            // cloud sync timestamp
}

interface TapEvent {
  cellIndex: number;
  expectedValue: number;
  tappedValue: number;
  correct: boolean;
  timestampMs: number;
}

interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  preferences: UserPreferences;
  stats: UserStats;
}
```

### Backend (Python + PostgreSQL)

```python
# models/user.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cognito_sub = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    display_name = Column(String(100))
    avatar_url = Column(String(500))
    preferences = Column(JSONB, default={})
    is_premium = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# models/session.py
class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    grid_size = Column(Integer, nullable=False)
    max_time = Column(Integer, nullable=False)
    order_mode = Column(String(10), nullable=False)  # ASC, DESC
    status = Column(String(20), nullable=False)      # completed, timeout, abandoned
    completion_time_ms = Column(Integer)
    mistakes = Column(Integer, default=0)
    accuracy = Column(Float)
    tap_events = Column(JSONB)                       # detailed tap data
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    # Indexes for leaderboard queries
    __table_args__ = (
        Index('idx_leaderboard', 'grid_size', 'order_mode', 'status', 'completion_time_ms'),
        Index('idx_user_sessions', 'user_id', 'started_at'),
    )


# models/leaderboard.py
class DailyLeaderboard(Base):
    __tablename__ = "daily_leaderboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("training_sessions.id"))
    grid_size = Column(Integer, nullable=False)
    order_mode = Column(String(10), nullable=False)
    best_time_ms = Column(Integer, nullable=False)
    date = Column(Date, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'grid_size', 'order_mode', 'date'),
        Index('idx_daily_ranking', 'date', 'grid_size', 'order_mode', 'best_time_ms'),
    )
```

### Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Training sessions
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    grid_size INTEGER NOT NULL,
    max_time INTEGER NOT NULL,
    order_mode VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    completion_time_ms INTEGER,
    mistakes INTEGER DEFAULT 0,
    accuracy FLOAT,
    tap_events JSONB,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user ON training_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_leaderboard ON training_sessions(grid_size, order_mode, status, completion_time_ms)
    WHERE status = 'completed';

-- Daily leaderboard (materialized for fast reads)
CREATE TABLE daily_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES training_sessions(id),
    grid_size INTEGER NOT NULL,
    order_mode VARCHAR(10) NOT NULL,
    best_time_ms INTEGER NOT NULL,
    date DATE NOT NULL,
    UNIQUE(user_id, grid_size, order_mode, date)
);

CREATE INDEX idx_daily_ranking ON daily_leaderboards(date, grid_size, order_mode, best_time_ms);

-- User statistics (denormalized for fast reads)
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_sessions INTEGER DEFAULT 0,
    completed_sessions INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_played_at TIMESTAMP,
    best_times JSONB DEFAULT '{}',    -- {"5-ASC": 28500, "6-ASC": 45000}
    avg_times JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## VIII. API Design (Backend)

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.schulte-app.com/api/v1`

### Authentication Endpoints

```
POST   /auth/register          # Register new user
POST   /auth/login             # Login (returns JWT)
POST   /auth/refresh           # Refresh access token
POST   /auth/logout            # Invalidate refresh token
POST   /auth/forgot-password   # Initiate password reset
POST   /auth/reset-password    # Complete password reset
GET    /auth/me                # Get current user profile
```

### User Endpoints

```
GET    /users/me                    # Get profile + stats
PATCH  /users/me                    # Update profile
PATCH  /users/me/preferences        # Update preferences
GET    /users/{user_id}             # Get public profile
GET    /users/{user_id}/stats       # Get user statistics
```

### Sessions Endpoints

```
POST   /sessions                    # Create/sync session
GET    /sessions                    # List user sessions (paginated)
GET    /sessions/{session_id}       # Get session details
DELETE /sessions/{session_id}       # Delete session
POST   /sessions/sync               # Bulk sync from offline
```

### Leaderboard Endpoints

```
GET    /leaderboards/daily                    # Today's rankings
GET    /leaderboards/daily/{date}             # Specific date
GET    /leaderboards/all-time                 # All-time best
GET    /leaderboards/weekly-challenge         # Current week challenge
GET    /leaderboards/friends                  # Friends only

# Query params: grid_size, order_mode, limit, offset
```

### API Response Format

```python
# Success response
{
    "status": "success",
    "data": { ... },
    "meta": {
        "page": 1,
        "per_page": 20,
        "total": 150
    }
}

# Error response
{
    "status": "error",
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Grid size must be between 5 and 7",
        "details": { ... }
    }
}
```

### OpenAPI Schema (FastAPI auto-generated)

```python
# schemas/session.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID

class TapEventSchema(BaseModel):
    cell_index: int = Field(..., ge=0)
    expected_value: int
    tapped_value: int
    correct: bool
    timestamp_ms: int = Field(..., ge=0)

class SessionCreate(BaseModel):
    grid_size: int = Field(..., ge=5, le=7)
    max_time: int = Field(..., ge=30, le=300)
    order_mode: str = Field(..., pattern="^(ASC|DESC)$")
    status: str = Field(..., pattern="^(completed|timeout|abandoned)$")
    completion_time_ms: Optional[int] = Field(None, ge=0)
    mistakes: int = Field(0, ge=0)
    accuracy: float = Field(..., ge=0, le=100)
    tap_events: List[TapEventSchema]
    started_at: datetime
    completed_at: Optional[datetime]

class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    grid_size: int
    max_time: int
    order_mode: str
    status: str
    completion_time_ms: Optional[int]
    mistakes: int
    accuracy: float
    started_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: UUID
    display_name: str
    avatar_url: Optional[str]
    best_time_ms: int
    session_date: datetime
```

---

## IX. Technology Stack

### Frontend (PWA)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14+ (App Router) | RSC, optimized bundling |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS v4 | Utility-first |
| UI Components | shadcn/ui | Accessible, customizable |
| Animations | Framer Motion | Declarative animations |
| State | Zustand | Lightweight |
| Local Storage | Dexie.js (IndexedDB) | Offline-first |
| API Client | TanStack Query | Caching, sync |
| Timer | Web Worker | Prevents throttling |
| PWA | next-pwa + Workbox | Offline, installable |

### Backend (Python)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | FastAPI | Async, auto-docs, type hints |
| Language | Python 3.11+ | Modern features, typing |
| ORM | SQLAlchemy 2.0 | Async support, mature |
| Migrations | Alembic | Database versioning |
| Validation | Pydantic v2 | Fast, integrated with FastAPI |
| Auth | AWS Cognito + python-jose | Managed auth, JWT validation |
| Caching | Redis (via aioredis) | Leaderboard caching |
| Testing | pytest + pytest-asyncio | Async test support |
| Linting | Ruff | Fast, replaces flake8/black/isort |
| Type Checking | mypy | Static type analysis |

### AWS Infrastructure

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Cognito** | User authentication | User pool + Identity pool |
| **API Gateway** | API management | REST API, throttling, WAF |
| **ECS Fargate** | Container orchestration | Auto-scaling, spot instances |
| **ECR** | Container registry | Docker image storage |
| **RDS PostgreSQL** | Primary database | Multi-AZ, auto-backup |
| **ElastiCache Redis** | Caching layer | Leaderboard, sessions |
| **S3** | Object storage | Static assets, logs |
| **CloudFront** | CDN | Frontend distribution |
| **Route 53** | DNS management | Domain routing |
| **ACM** | SSL certificates | HTTPS everywhere |
| **CloudWatch** | Monitoring & logs | Metrics, alarms, dashboards |
| **X-Ray** | Distributed tracing | Request tracing |
| **Secrets Manager** | Secret storage | DB credentials, API keys |
| **Parameter Store** | Configuration | Environment variables |

### Infrastructure as Code

| Tool | Purpose |
|------|---------|
| **Terraform** | AWS resource provisioning |
| **Docker** | Container packaging |
| **GitHub Actions** | CI/CD pipelines |

---

## X. Project Structure

### Monorepo Structure

```
schulte-app/
├── frontend/                      # Next.js PWA
│   ├── public/
│   │   ├── manifest.json
│   │   ├── icons/
│   │   └── sounds/
│   ├── src/
│   │   ├── app/                   # Next.js App Router
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── workers/
│   │   └── types/
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app entry
│   │   ├── config.py             # Settings management
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py           # Dependencies (auth, db)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py     # API router
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── sessions.py
│   │   │       └── leaderboards.py
│   │   ├── models/               # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── leaderboard.py
│   │   ├── schemas/              # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── leaderboard.py
│   │   ├── services/             # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── session.py
│   │   │   ├── leaderboard.py
│   │   │   └── stats.py
│   │   ├── repositories/         # Data access layer
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── leaderboard.py
│   │   └── core/
│   │       ├── __init__.py
│   │       ├── database.py       # DB connection
│   │       ├── redis.py          # Redis client
│   │       ├── security.py       # JWT, hashing
│   │       └── exceptions.py     # Custom exceptions
│   ├── alembic/                  # DB migrations
│   │   ├── versions/
│   │   └── env.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_sessions.py
│   │   └── test_leaderboards.py
│   ├── Dockerfile
│   ├── pyproject.toml            # Poetry/pip dependencies
│   ├── alembic.ini
│   └── .env.example
│
├── infrastructure/               # Terraform IaC
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   ├── staging/
│   │   └── prod/
│   ├── modules/
│   │   ├── networking/           # VPC, subnets, security groups
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── ecs/                  # ECS cluster, services, tasks
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── rds/                  # PostgreSQL database
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── elasticache/          # Redis cluster
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── cognito/              # User authentication
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── api-gateway/          # API Gateway
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── cloudfront/           # CDN distribution
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── monitoring/           # CloudWatch, X-Ray
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── secrets/              # Secrets Manager
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   └── shared/
│       └── backend.tf            # Terraform state backend (S3)
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint, test, type-check
│       ├── deploy-frontend.yml   # Deploy to Vercel/CloudFront
│       ├── deploy-backend.yml    # Build & deploy to ECS
│       └── terraform.yml         # Infrastructure changes
│
├── docker-compose.yml            # Local development
├── Makefile                      # Common commands
└── README.md
```

---

## XI. AWS Infrastructure Details

### VPC Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VPC (10.0.0.0/16)                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Availability Zone A                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │ Public Subnet   │  │ Private Subnet  │  │ Private Subnet  │     │   │
│  │  │ 10.0.1.0/24     │  │ 10.0.10.0/24    │  │ 10.0.20.0/24    │     │   │
│  │  │                 │  │                 │  │                 │     │   │
│  │  │ • NAT Gateway   │  │ • ECS Tasks     │  │ • RDS Primary   │     │   │
│  │  │ • ALB           │  │ • Lambda        │  │ • ElastiCache   │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Availability Zone B                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │ Public Subnet   │  │ Private Subnet  │  │ Private Subnet  │     │   │
│  │  │ 10.0.2.0/24     │  │ 10.0.11.0/24    │  │ 10.0.21.0/24    │     │   │
│  │  │                 │  │                 │  │                 │     │   │
│  │  │ • NAT Gateway   │  │ • ECS Tasks     │  │ • RDS Standby   │     │   │
│  │  │ • ALB           │  │ • Lambda        │  │ • ElastiCache   │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Internet Gateway ←→ Public Subnets ←→ NAT Gateway ←→ Private Subnets      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Groups

```hcl
# ALB Security Group
resource "aws_security_group" "alb" {
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS Tasks Security Group
resource "aws_security_group" "ecs_tasks" {
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

# ElastiCache Security Group
resource "aws_security_group" "redis" {
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}
```

### ECS Task Definition

```hcl
resource "aws_ecs_task_definition" "api" {
  family                   = "schulte-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:latest"

      portMappings = [{
        containerPort = 8000
        protocol      = "tcp"
      }]

      environment = [
        { name = "ENVIRONMENT", value = var.environment },
        { name = "AWS_REGION", value = var.aws_region }
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/schulte-api"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}
```

### RDS Configuration

```hcl
resource "aws_db_instance" "postgres" {
  identifier = "schulte-${var.environment}"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.environment == "prod" ? "db.t3.medium" : "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "schulte"
  username = "schulte_admin"
  password = random_password.db_password.result

  multi_az               = var.environment == "prod"
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"

  performance_insights_enabled = var.environment == "prod"

  tags = {
    Environment = var.environment
    Project     = "schulte-app"
  }
}
```

### Cognito User Pool

```hcl
resource "aws_cognito_user_pool" "main" {
  name = "schulte-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "display_name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "schulte-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = ["COGNITO", "Google", "SignInWithApple"]

  callback_urls = var.environment == "prod" ? [
    "https://schulte-app.com/auth/callback"
  ] : [
    "http://localhost:3000/auth/callback"
  ]
}
```

---

## XII. CI/CD Pipeline

### GitHub Actions Workflows

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install poetry
          poetry install
      - run: poetry run ruff check .
      - run: poetry run mypy .
      - run: poetry run pytest --cov

  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infrastructure/environments/dev
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform validate
      - run: terraform plan
```

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - uses: aws-actions/amazon-ecr-login@v2
        id: login-ecr

      - name: Build and push Docker image
        working-directory: backend
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: schulte-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster schulte-prod \
            --service schulte-api \
            --force-new-deployment
```

---

## XIII. Monitoring & Observability

### CloudWatch Dashboard Metrics

| Metric | Source | Alarm Threshold |
|--------|--------|-----------------|
| API Latency (p99) | ALB | > 500ms |
| API Error Rate | ALB | > 1% |
| ECS CPU Utilization | ECS | > 80% |
| ECS Memory Utilization | ECS | > 80% |
| RDS CPU | RDS | > 80% |
| RDS Connections | RDS | > 80% of max |
| RDS Free Storage | RDS | < 10GB |
| Redis Memory | ElastiCache | > 80% |
| Redis Connections | ElastiCache | > 80% of max |

### Logging Structure

```python
# Structured logging format
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "service": "schulte-api",
    "trace_id": "abc123",
    "user_id": "user-uuid",
    "method": "POST",
    "path": "/api/v1/sessions",
    "status_code": 201,
    "duration_ms": 45,
    "message": "Session created successfully"
}
```

---

## XIV. Cost Estimation (Monthly)

### Development Environment
| Service | Configuration | Est. Cost |
|---------|--------------|-----------|
| ECS Fargate | 0.25 vCPU, 0.5GB, 1 task | ~$10 |
| RDS PostgreSQL | db.t3.micro, 20GB | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$12 |
| NAT Gateway | 1 AZ | ~$32 |
| CloudWatch | Basic logs | ~$5 |
| **Total** | | **~$74/month** |

### Production Environment
| Service | Configuration | Est. Cost |
|---------|--------------|-----------|
| ECS Fargate | 0.5 vCPU, 1GB, 2-4 tasks | ~$50 |
| RDS PostgreSQL | db.t3.small, Multi-AZ, 50GB | ~$60 |
| ElastiCache Redis | cache.t3.small, 2 nodes | ~$50 |
| NAT Gateway | 2 AZ | ~$64 |
| ALB | 1 ALB | ~$20 |
| CloudFront | 100GB transfer | ~$10 |
| CloudWatch | Enhanced | ~$20 |
| Route 53 | 1 hosted zone | ~$1 |
| **Total** | | **~$275/month** |

---

## XV. Roadmap (Updated)

### Phase 1 – MVP (v1.0)
- Frontend PWA with offline-first
- Local storage only
- Basic Schulte training

### Phase 2 – Backend Foundation (v1.5)
- FastAPI backend setup
- AWS infrastructure (Terraform)
- User authentication (Cognito)
- Basic cloud sync

### Phase 3 – Cloud Integration (v2.0)
- Full cloud sync
- Global leaderboards
- Daily challenges
- CI/CD pipeline

### Phase 4 – Scale & Optimize (v2.5)
- Performance optimization
- Caching strategy
- Analytics dashboard
- Premium features

### Phase 5 – AI Features (v3.0)
- Adaptive difficulty
- Cognitive analytics
- Personalized recommendations

---

## XVI. Local Development Setup

```bash
# Clone and setup
git clone https://github.com/your-username/schulte-app.git
cd schulte-app

# Start all services
docker-compose up -d

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Backend (separate terminal)
cd backend
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload

# Infrastructure (optional - for testing Terraform)
cd infrastructure/environments/dev
terraform init
terraform plan
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: schulte
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: schulte
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=cognito,secretsmanager,ssm
      - DEBUG=1

volumes:
  postgres_data:
```

---

## XVII. Dependencies

### Backend (pyproject.toml)

```toml
[tool.poetry]
name = "schulte-backend"
version = "1.0.0"
python = "^3.11"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
sqlalchemy = {extras = ["asyncio"], version = "^2.0.25"}
asyncpg = "^0.29.0"
alembic = "^1.13.1"
pydantic = "^2.5.3"
pydantic-settings = "^2.1.0"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
redis = "^5.0.1"
httpx = "^0.26.0"
structlog = "^24.1.0"
boto3 = "^1.34.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.4"
pytest-asyncio = "^0.23.3"
pytest-cov = "^4.1.0"
ruff = "^0.1.13"
mypy = "^1.8.0"
types-redis = "^4.6.0"

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W", "UP"]

[tool.mypy]
python_version = "3.11"
strict = true
```

### Frontend (package.json)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.0",
    "@tanstack/react-query": "^5.17.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "uuid": "^9.0.0",
    "aws-amplify": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tailwindcss": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "next-pwa": "^5.6.0",
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.0"
  }
}
```
