#!/bin/bash
# =============================================================================
# Deploy Schulte Backend to EC2
# =============================================================================
# Usage: bash infrastructure/scripts/deploy.sh
# =============================================================================
set -euo pipefail

EC2_IP="54.169.65.37"
EC2_USER="ec2-user"
KEY="$HOME/.ssh/schulte_table.pem"
AWS_REGION="ap-southeast-1"
SSM_DB_PASSWORD_PATH="/schulte-app/dev/db-password"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../../backend"
REMOTE_DIR="/home/ec2-user/backend"

echo "=== Deploying Schulte Backend ==="
echo "    Target : $EC2_USER@$EC2_IP"
echo ""

# -----------------------------------------------------------------------------
# 0. Ensure rsync is installed on EC2
# -----------------------------------------------------------------------------
echo "[0/5] Checking EC2 dependencies..."
ssh -i "$KEY" "$EC2_USER@$EC2_IP" "which rsync >/dev/null 2>&1 || sudo dnf install -y rsync"

# -----------------------------------------------------------------------------
# 1. Sync backend code (exclude local-only files)
# -----------------------------------------------------------------------------
echo ""
echo "[1/5] Syncing backend code..."
rsync -az \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env' \
  --exclude '.pytest_cache' \
  --exclude 'tests/' \
  -e "ssh -i $KEY" \
  "$BACKEND_DIR/" "$EC2_USER@$EC2_IP:$REMOTE_DIR/"

# -----------------------------------------------------------------------------
# 2. Copy .env (written by EC2 user-data) into backend dir
# -----------------------------------------------------------------------------
echo ""
echo "[2/5] Setting up .env..."
ssh -i "$KEY" "$EC2_USER@$EC2_IP" "cp ~/.env $REMOTE_DIR/.env"

# -----------------------------------------------------------------------------
# 3. Build Docker image using docker compose (correct image name)
# -----------------------------------------------------------------------------
echo ""
echo "[3/5] Building Docker image..."
ssh -i "$KEY" "$EC2_USER@$EC2_IP" \
  "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml down --remove-orphans && \
   docker compose -f docker-compose.prod.yml build"

# -----------------------------------------------------------------------------
# 4. Run Alembic migrations
# EC2 fetches its own DB password from SSM using its IAM role
# -----------------------------------------------------------------------------
echo ""
echo "[4/5] Running migrations..."
ssh -i "$KEY" "$EC2_USER@$EC2_IP" \
  "DB_PASS=\$(aws ssm get-parameter \
      --name $SSM_DB_PASSWORD_PATH \
      --with-decryption \
      --query Parameter.Value \
      --output text \
      --region $AWS_REGION) && \
   cd $REMOTE_DIR && \
   docker compose -f docker-compose.prod.yml run --rm \
     -e DB_PASSWORD=\"\$DB_PASS\" \
     -e DB_SSL=true \
     api alembic upgrade head"

# -----------------------------------------------------------------------------
# 5. Start / restart service
# -----------------------------------------------------------------------------
echo ""
echo "[5/5] Starting service..."
ssh -i "$KEY" "$EC2_USER@$EC2_IP" \
  "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml up -d"

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
echo ""
echo "Waiting 10s for service to start..."
sleep 10
echo ""
HEALTH=$(curl -s "http://$EC2_IP/health" 2>/dev/null || echo '{"status":"unreachable"}')
echo "Health → $HEALTH"

if echo "$HEALTH" | grep -q '"healthy"'; then
  echo ""
  echo "=== Deployment successful! ==="
  echo "API: http://$EC2_IP"
else
  echo ""
  echo "=== Service may still be starting. Check logs with: ==="
  echo "ssh -i $KEY $EC2_USER@$EC2_IP 'cd ~/backend && docker compose -f docker-compose.prod.yml logs --tail=30'"
fi
