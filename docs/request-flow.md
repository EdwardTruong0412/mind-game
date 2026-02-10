# Request Flow Documentation

This document explains the typical request flows in the Schulte Table Training App architecture.

## 🔐 Flow 1: User Authentication (First Time)

```
1. User clicks "Login with Google" in Frontend (Vercel)
   ↓
2. Frontend redirects to Cognito Hosted UI
   ↓
3. User authenticates with Google
   ↓
4. Cognito redirects back to Frontend with authorization code
   ↓
5. Frontend exchanges code for JWT tokens (access + refresh)
   ↓
6. Frontend stores JWT in memory/localStorage
   ↓
7. User is now authenticated
```

## 📊 Flow 2: Typical API Request (Authenticated User Syncing Data)

This is the most common flow - user completes training sessions offline, then syncs:

```
1. Frontend (PWA on Vercel)
   - User completes a training session
   - Data saved to IndexedDB (Dexie.js) immediately
   - App works 100% offline at this point ✅

2. When online, Frontend initiates sync:
   POST /api/v1/sessions/sync
   Headers: Authorization: Bearer <JWT_TOKEN>
   Body: { sessions: [...offline sessions...] }
   ↓

3. Request goes to CloudFlare
   - HTTPS termination
   - DDoS protection
   - DNS resolution
   - Proxies request to EC2 public IP
   ↓

4. Backend (FastAPI on EC2)
   - Receives request
   - Extracts JWT from Authorization header
   - Validates JWT with Cognito (via boto3):
     * Verifies signature
     * Checks expiration
     * Extracts user ID (Cognito sub)
   ↓

5. If JWT valid:
   - Service layer processes sync logic
   - Repository layer queries Database (RDS PostgreSQL)
   - Checks for existing sessions via client_session_id (idempotency)
   - Inserts new sessions
   - Updates user_stats table (denormalized aggregates)
   - Updates daily_leaderboards (if session completed)
   ↓

6. Database (RDS PostgreSQL in private subnet)
   - Executes SQL queries
   - Only accessible from EC2 security group
   - Returns results to Backend
   ↓

7. Backend sends response back:
   { "synced": 5, "skipped": 2, "errors": [] }
   ↓

8. CloudFlare proxies response back to Frontend
   ↓

9. Frontend receives response:
   - Marks local sessions as synced in IndexedDB
   - Updates UI to show sync status
   - User sees confirmation ✅
```

## 📈 Flow 3: Fetching Leaderboard (Read-Only Request)

```
1. Frontend: GET /api/v1/leaderboards/daily
   Headers: Authorization: Bearer <JWT_TOKEN>
   ↓

2. CloudFlare → Backend (EC2)
   ↓

3. Backend validates JWT with Cognito
   ↓

4. Backend queries daily_leaderboards table in RDS
   - Denormalized table (pre-computed rankings)
   - Fast read, no complex JOINs needed
   ↓

5. Backend returns JSON:
   [{
     "rank": 1,
     "username": "user123",
     "best_time": 12.5,
     "grid_size": 5,
     "date": "2026-02-10"
   }, ...]
   ↓

6. Frontend displays leaderboard
```

## 🔄 Key Architectural Highlights

### Offline-First Pattern
- Frontend works completely offline
- IndexedDB stores all training data locally
- Sync happens opportunistically when online
- No data loss if network is down

### Security Layers
- **CloudFlare**: HTTPS, DDoS protection
- **Cognito**: OAuth2/OIDC standard JWT tokens
- **Backend**: JWT validation on every request
- **RDS**: Private subnet, only EC2 can access

### Performance Optimizations
- Denormalized `user_stats` table (no aggregation queries)
- Denormalized `daily_leaderboards` (pre-computed rankings)
- Idempotency via `client_session_id` (prevents duplicate syncs)
- IndexedDB for instant local reads

### Free Tier Optimization
- No NAT Gateway (EC2 in public subnet talks directly to CloudFlare)
- No ALB (low traffic, CloudFlare handles load balancing)
- SSM Parameter Store for secrets (free vs Secrets Manager)

## 📍 Current Status

- ✅ **Frontend**: Deployed and working on Vercel
- ⚠️ **Backend**: Implemented but NOT deployed to EC2 yet
- 🔵 **Infrastructure**: Terraform created but NOT applied yet

Once you deploy the infrastructure and backend, this entire flow will be live!

## 🔍 Detailed Component Interactions

### Frontend → Backend Communication
- **Protocol**: HTTPS via CloudFlare
- **Auth**: JWT Bearer token in Authorization header
- **Format**: JSON request/response
- **Idempotency**: Uses `client_session_id` (UUID) to prevent duplicate operations

### Backend → Cognito Verification
- **Library**: boto3 (AWS SDK for Python)
- **Method**: JWT signature verification using Cognito public keys
- **Validation**: Checks token signature, expiration, issuer, audience

### Backend → Database Queries
- **ORM**: SQLAlchemy 2.0 (async)
- **Connection**: PostgreSQL connection pool
- **Security**: Private subnet, security group restricted to EC2
- **Secrets**: Database password stored in SSM Parameter Store

### Data Flow Architecture

```
┌─────────────┐
│   Browser   │
│  (Offline)  │
└─────┬───────┘
      │ IndexedDB (Dexie.js)
      │ Local-first storage
      ↓
┌─────────────┐
│  Frontend   │ ← Deployed on Vercel
│  (Next.js)  │   Global CDN
└─────┬───────┘
      │ HTTPS
      ↓
┌─────────────┐
│ CloudFlare  │ ← SSL/TLS termination
│  (Proxy)    │   DDoS protection
└─────┬───────┘
      │ HTTP (proxied)
      ↓
┌─────────────┐     ┌──────────┐
│   Backend   │────→│ Cognito  │ JWT validation
│  (FastAPI)  │←────│          │
└─────┬───────┘     └──────────┘
      │ SQL queries
      ↓
┌─────────────┐
│  Database   │ ← Private subnet
│ (PostgreSQL)│   Only EC2 access
└─────────────┘
```

## 🚀 Next Steps for Deployment

1. **Bootstrap Terraform State**
   ```bash
   cd infrastructure/awsenv/bootstrap
   terraform init
   terraform apply -var-file=bootstrap.tfvars
   ```

2. **Deploy Infrastructure**
   ```bash
   cd infrastructure/awsenv/env/dev
   terraform init
   terraform plan -var-file=dev.tfvars
   terraform apply -var-file=dev.tfvars
   ```

3. **Deploy Backend to EC2**
   ```bash
   # SSH to EC2
   ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_IP>

   # Clone repo and deploy with Docker
   git clone <repo>
   cd backend
   docker-compose up -d
   ```

4. **Configure Frontend**
   - Update environment variables with API URL
   - Point to CloudFlare domain
   - Deploy updated frontend to Vercel
