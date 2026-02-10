# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Schulte Table Training App - A full-stack PWA for cognitive training with cloud sync, leaderboards, and analytics. Combines modern frontend with Python backend and AWS infrastructure.

## Current Status

- **Frontend:** Complete MVP, deployed on Vercel with custom domain, supports EN/VI
- **Infrastructure:** Terraform files created (AWS free tier), not yet deployed
- **Backend:** Not yet built (FastAPI planned)
- **Git:** Only `frontend/` has a git repo. Root is NOT a git repo.

## Tech Stack

### Frontend (PWA) — BUILT
- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand
- **Local Storage:** Dexie.js (IndexedDB)
- **Animations:** Framer Motion
- **i18n:** Custom solution (EN/VI)

### Backend (Python) — PLANNED
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.0 + Alembic migrations
- **Validation:** Pydantic v2
- **Auth:** AWS Cognito + python-jose (JWT)
- **Linting:** Ruff + mypy

### AWS Infrastructure — TERRAFORM CREATED, NOT DEPLOYED
- **Region:** ap-southeast-1 (Singapore)
- **Compute:** EC2 t2.micro (free tier) — NOT ECS Fargate
- **Database:** RDS db.t4g.micro PostgreSQL 15 (free tier, single-AZ)
- **Auth:** Cognito User Pool (always free, 50K MAU)
- **Secrets:** SSM Parameter Store (free) — NOT Secrets Manager
- **HTTPS/DNS:** CloudFlare free tier (external, not in Terraform)
- **IaC:** Terraform with S3 backend + DynamoDB locking
- **Cost:** $0/month within 12-month free tier

### What We Intentionally Skip (Cost Traps)
- NO NAT Gateway (~$32/month)
- NO ECS Fargate (no free tier)
- NO ALB (unnecessary at <10 req/hour)
- NO ElastiCache Redis (PostgreSQL handles everything at this scale)
- NO API Gateway + WAF (CloudFlare handles this)
- NO CloudFront (frontend on Vercel, API behind CloudFlare)

## Build Commands

```bash
# Frontend
cd frontend && npm run dev      # Development server
cd frontend && npm run build    # Production build
cd frontend && npm run lint     # ESLint + type-check

# Infrastructure — Bootstrap (one-time)
cd infrastructure/awsenv/bootstrap && terraform init
cd infrastructure/awsenv/bootstrap && terraform apply -var-file=bootstrap.tfvars

# Infrastructure — Dev (after updating backend.tf with bucket name)
cd infrastructure/awsenv/env/dev && terraform init
cd infrastructure/awsenv/env/dev && terraform plan -var-file=dev.tfvars
cd infrastructure/awsenv/env/dev && terraform apply -var-file=dev.tfvars

# Backend (planned)
cd backend && poetry install
cd backend && poetry run alembic upgrade head
cd backend && poetry run uvicorn app.main:app --reload
cd backend && poetry run ruff check .
cd backend && poetry run pytest --cov
```

## Project Structure

```
schulte-app/
├── frontend/                  # Next.js PWA (BUILT)
│   ├── src/app/               # App Router pages (home, train, history)
│   ├── src/components/        # UI components (schulte-grid, timer, etc.)
│   ├── src/lib/               # Core logic (db, game-logic, i18n)
│   ├── src/hooks/             # Custom hooks (settings, timer, language)
│   ├── src/stores/            # Zustand (game-store)
│   └── src/types/             # TypeScript types
├── infrastructure/            # Terraform (CREATED)
│   ├── awsenv/                # AWS environment configs
│   │   ├── .gitignore         # Ignores .tfstate, .terraform/, terraform.tfvars
│   │   ├── bootstrap/         # S3 + DynamoDB for TF remote state
│   │   │   ├── main.tf
│   │   │   ├── variables.tf           # aws_region, project_name
│   │   │   └── bootstrap.tfvars       # Bootstrap variable values
│   │   └── env/
│   │       ├── dev/           # Dev environment orchestration
│   │       │   ├── backend.tf         # Terraform + provider + S3 backend config
│   │       │   ├── networking.tf      # Networking module call
│   │       │   ├── compute.tf         # Compute module call
│   │       │   ├── database.tf        # Database module call
│   │       │   ├── auth.tf            # Auth module call
│   │       │   ├── variables.tf       # Input variables with defaults
│   │       │   ├── outputs.tf         # EC2 IP, RDS endpoint, Cognito IDs
│   │       │   └── dev.tfvars         # Dev variable values (template)
│   │       └── prd/           # Production (placeholder)
│   ├── modules/               # Shared reusable modules
│   │   ├── networking/        # VPC, subnets, IGW, SGs
│   │   ├── compute/           # EC2, EIP, IAM role
│   │   ├── database/          # RDS PostgreSQL, SSM params
│   │   └── auth/              # Cognito user pool + client
│   └── scripts/               # Shared scripts
│       └── user-data.sh       # EC2 bootstrap (Docker, env config)
├── backend/                   # FastAPI (PLANNED, not yet created)
├── CLAUDE.md
└── Schulte_Table_App_Basic_Design.md
```

## Infrastructure Architecture

```
CloudFlare (HTTPS + DNS) → EC2 t2.micro (public subnet) → RDS db.t4g.micro (private subnet)
                           Cognito (auth, always free)
                           SSM Parameter Store (secrets, free)
```

- EC2 in public subnet (no NAT Gateway needed)
- RDS in private subnet (only accessible from EC2 security group)
- 2 private subnets across 2 AZs (AWS requirement for RDS subnet group)
- SSH restricted to specific IP via `allowed_ssh_cidr` variable

## Infrastructure File Layout

- `awsenv/` — AWS-specific Terraform configs, separated by environment (dev/prd)
- `modules/` — Shared reusable Terraform modules (used by all environments)
- `scripts/` — Shared scripts (EC2 user-data, etc.)

## Infrastructure Deployment Prerequisites

1. Create new AWS account (12-month free tier)
2. Install Terraform >= 1.5 and AWS CLI
3. Configure AWS profile: `aws configure --profile schulte-dev`
4. Create EC2 key pair in ap-southeast-1
5. Edit `dev.tfvars` with your values (aws_profile, allowed_ssh_cidr, ec2_key_pair_name)

## Key Patterns

- **Offline-first:** Frontend works without backend; syncs when online
- **Free-tier optimized:** All AWS resources within free tier limits
- **SSM for secrets:** DB password auto-generated by Terraform, stored in SSM Parameter Store SecureString
- **User-data bootstrap:** EC2 auto-installs Docker + Docker Compose on first boot
- **JWT auth:** Cognito issues tokens, backend validates with python-jose

## API Endpoints (Planned)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/users/me
POST   /api/v1/sessions
GET    /api/v1/sessions
POST   /api/v1/sessions/sync
GET    /api/v1/leaderboards/daily
GET    /api/v1/leaderboards/all-time
```

## Data Models

- `User`: Cognito-linked user with preferences
- `TrainingSession`: Session with tap events (JSONB)
- `DailyLeaderboard`: Denormalized daily rankings
- `UserStats`: Aggregated statistics

See `Schulte_Table_App_Basic_Design.md` for complete schemas.

## Next Steps

1. User creates AWS account + configures CLI
2. Run bootstrap (`infrastructure/awsenv/bootstrap/`)
3. Update `backend.tf` with actual S3 bucket name
4. Run main Terraform (`infrastructure/awsenv/env/dev/`)
5. Build FastAPI backend and deploy to EC2 via Docker
