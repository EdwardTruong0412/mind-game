#!/bin/bash
set -euo pipefail
exec > /var/log/user-data.log 2>&1

echo "=== Starting EC2 bootstrap $(date) ==="

# Update system
dnf update -y

# Install Docker
dnf install -y docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose v2 plugin
DOCKER_COMPOSE_VERSION="v2.24.5"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install PostgreSQL client (for manual DB testing)
dnf install -y postgresql15

# Install git
dnf install -y git

# Write environment config for the backend app
cat > /home/ec2-user/.env <<'ENVEOF'
# Schulte App Backend Environment
# DB password should be fetched from SSM at runtime
APP_ENVIRONMENT=${environment}
AWS_REGION=${aws_region}

# Database
DB_HOST=${db_address}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USERNAME=${db_username}
DB_PASSWORD_SSM_PATH=${ssm_db_password_path}

# Cognito
COGNITO_USER_POOL_ID=${cognito_user_pool_id}
COGNITO_CLIENT_ID=${cognito_client_id}
COGNITO_REGION=${aws_region}
ENVEOF

chown ec2-user:ec2-user /home/ec2-user/.env
chmod 600 /home/ec2-user/.env

echo "=== EC2 bootstrap completed $(date) ==="
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
