# Infrastructure Design Document

## Overview

The Schulte Table Training App runs on AWS, optimized for the 12-month free tier. The infrastructure is defined as Terraform code (IaC), deployed in `ap-southeast-1` (Singapore), and costs $0/month within free tier limits.

The architecture is intentionally simple: a single EC2 instance running Docker, an RDS PostgreSQL database, and Cognito for authentication. No load balancers, no container orchestration, no cache layer. CloudFlare (external, free tier) handles HTTPS termination and DNS.

---

## Architecture Diagram

```
                        Internet
                           │
                    ┌──────┴──────┐
                    │  CloudFlare │  ← HTTPS termination, DNS, DDoS protection
                    │  (external) │     Not managed by Terraform
                    └──────┬──────┘
                           │ HTTP (port 80)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    VPC  10.0.0.0/16                           │
│                                                               │
│   ┌─────────────────────────────────────────┐                │
│   │  Public Subnet  10.0.1.0/24             │                │
│   │  (ap-southeast-1a)                      │                │
│   │                                          │                │
│   │   ┌──────────────────────┐              │                │
│   │   │  EC2 t2.micro        │              │                │
│   │   │  Amazon Linux 2023   │              │                │
│   │   │  Docker + FastAPI     │              │                │
│   │   │  Elastic IP attached  │              │                │
│   │   └──────────┬───────────┘              │                │
│   │              │                           │                │
│   └──────────────┼───────────────────────────┘                │
│                  │ Port 5432 (via Security Group)              │
│   ┌──────────────┼───────────────────────────┐                │
│   │  Private Subnet 1  10.0.10.0/24         │                │
│   │  (ap-southeast-1a)                      │                │
│   │              │                           │                │
│   │   ┌──────────┴───────────┐              │                │
│   │   │  RDS db.t4g.micro    │              │                │
│   │   │  PostgreSQL 15       │              │                │
│   │   │  20GB gp2            │              │                │
│   │   └──────────────────────┘              │                │
│   │                                          │                │
│   └──────────────────────────────────────────┘                │
│                                                               │
│   ┌──────────────────────────────────────────┐                │
│   │  Private Subnet 2  10.0.11.0/24         │                │
│   │  (ap-southeast-1b)                      │                │
│   │  (Required for RDS subnet group,         │                │
│   │   no resources placed here)              │                │
│   └──────────────────────────────────────────┘                │
│                                                               │
└──────────────────────────────────────────────────────────────┘

External AWS Services (no VPC placement):
  ┌────────────┐  ┌──────────────────────┐
  │  Cognito   │  │  SSM Parameter Store │
  │  User Pool │  │  (DB password,       │
  │  (auth)    │  │   endpoint, config)  │
  └────────────┘  └──────────────────────┘
```

---

## Design Decisions & Cost Traps Avoided

| Decision | Why | Savings |
|----------|-----|---------|
| EC2 in public subnet | Avoids NAT Gateway entirely | ~$32/month saved |
| No ALB | Single EC2, CloudFlare handles HTTPS | ~$20/month saved |
| No ECS Fargate | No free tier for Fargate | ~$10+/month saved |
| No ElastiCache Redis | PostgreSQL handles everything at <10 req/hour | ~$12/month saved |
| No API Gateway | CloudFlare proxies, FastAPI handles routing | ~$3.50/month saved |
| No CloudFront | Frontend on Vercel CDN already | ~$0 (usage-based) |
| SSM Parameter Store | Free standard parameters | ~$0.40/secret saved vs Secrets Manager |
| Single-AZ RDS | Dev only, no multi-AZ failover needed | Free tier preserved |
| gp2 storage (not gp3) | 20GB gp2 included in free tier | ~$1.60/month saved |
| DynamoDB PAY_PER_REQUEST | Near-zero cost for state locking | ~$0.50/month saved |

**Total free-tier cost: ~$0/month** (within 12-month limits)

---

## Terraform Organization

```
infrastructure/
├── awsenv/
│   ├── .gitignore                   # Ignores .tfstate, .terraform/, terraform.tfvars
│   ├── bootstrap/                   # One-time: S3 + DynamoDB for TF state
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── bootstrap.tfvars
│   └── env/
│       ├── dev/                     # Dev environment orchestration
│       │   ├── backend.tf           # Terraform config + AWS provider
│       │   ├── networking.tf        # Module call → modules/networking
│       │   ├── compute.tf           # Module call → modules/compute
│       │   ├── database.tf          # Module call → modules/database
│       │   ├── auth.tf              # Module call → modules/auth
│       │   ├── variables.tf         # All input variables with defaults
│       │   ├── outputs.tf           # EC2 IP, RDS endpoint, Cognito IDs
│       │   └── dev.tfvars           # User-specific values (template)
│       └── prd/                     # Production (placeholder, .gitkeep only)
├── modules/                         # Shared reusable modules
│   ├── networking/
│   │   ├── main.tf                  # VPC, subnets, IGW, routes, security groups
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   │   ├── main.tf                  # EC2, EIP, IAM role + policies
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── database/
│   │   ├── main.tf                  # RDS, subnet group, SSM parameters
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── auth/
│       ├── main.tf                  # Cognito user pool, client, domain
│       ├── variables.tf
│       └── outputs.tf
└── scripts/
    └── user-data.sh                 # EC2 bootstrap (Docker, env config)
```

**Why split orchestration files?** Instead of one giant `main.tf`, each resource group has its own file (`networking.tf`, `compute.tf`, etc.). This makes it easy to see what each file is responsible for and to modify one layer without touching others.

**Module references:** All environment orchestration files reference shared modules via relative paths:
```hcl
module "networking" {
  source = "../../../modules/networking"
}
```

---

## Bootstrap Infrastructure

### Purpose

Before the main infrastructure can be deployed, Terraform needs a place to store its state file. The bootstrap creates:

1. **S3 Bucket** — Stores `terraform.tfstate` (the record of what Terraform has created)
2. **DynamoDB Table** — Provides state locking (prevents two people from running Terraform simultaneously)

### Resources

| Resource | Name | Configuration |
|----------|------|---------------|
| S3 Bucket | `schulte-app-tf-state-{ACCOUNT_ID}` | Versioned, AES256 encrypted, all public access blocked, old versions expire after 30 days |
| DynamoDB Table | `schulte-app-tf-locks` | Partition key: `LockID` (String), PAY_PER_REQUEST billing |

### Variables

```hcl
aws_profile  = "schulte-dev"
aws_region   = "ap-southeast-1"
project_name = "schulte-app"
```

### Outputs

- `state_bucket_name` — Copy this into `backend.tf` after running bootstrap
- `dynamodb_table_name` — Copy this into `backend.tf`

### Deployment

```bash
cd infrastructure/awsenv/bootstrap
terraform init
terraform apply -var-file=bootstrap.tfvars
# Note the output values → update env/dev/backend.tf
```

---

## Networking Module

### Purpose

Creates the VPC, subnets, internet gateway, route tables, and security groups that all other resources live in.

### VPC

```
CIDR Block:      10.0.0.0/16  (65,536 IPs)
DNS Support:     Enabled
DNS Hostnames:   Enabled
```

**Why /16?** Gives plenty of room for future subnets. AWS recommends /16 for most VPCs.

### Subnets

| Subnet | CIDR | AZ | Type | Auto-assign Public IP | Purpose |
|--------|------|-----|------|----------------------|---------|
| Public | 10.0.1.0/24 | ap-southeast-1a | Public | Yes | EC2 instance |
| Private 1 | 10.0.10.0/24 | ap-southeast-1a | Private | No | RDS (could host primary) |
| Private 2 | 10.0.11.0/24 | ap-southeast-1b | Private | No | RDS (AWS requires 2 AZs for subnet group) |

**Why 2 private subnets in different AZs?** AWS requires a DB subnet group to span at least 2 availability zones, even for single-AZ deployments. This is a hard AWS requirement, not a choice.

**Why no second public subnet?** Only one EC2 instance. No load balancer. One public subnet is sufficient.

### Internet Gateway

Attached to the VPC. Allows the public subnet to reach the internet and be reachable from the internet.

### Route Tables

**Public route table (associated with public subnet):**

| Destination | Target | Purpose |
|-------------|--------|---------|
| 10.0.0.0/16 | local | VPC internal traffic |
| 0.0.0.0/0 | Internet Gateway | All other traffic → internet |

**Private route table (associated with both private subnets):**

| Destination | Target | Purpose |
|-------------|--------|---------|
| 10.0.0.0/16 | local | VPC internal traffic only |

**No 0.0.0.0/0 route in private table.** Private subnets have NO internet access. This is by design — RDS doesn't need internet, and avoiding a NAT Gateway saves ~$32/month.

### Security Groups

#### EC2 Security Group

**Purpose:** Controls what traffic can reach the EC2 instance and what it can send out.

| Direction | Port | Protocol | Source/Dest | Purpose |
|-----------|------|----------|-------------|---------|
| Ingress | 22 | TCP | `allowed_ssh_cidr` (your IP/32) | SSH access for deployment & debugging |
| Ingress | 80 | TCP | 0.0.0.0/0 | HTTP from CloudFlare |
| Ingress | 443 | TCP | 0.0.0.0/0 | HTTPS from CloudFlare |
| Egress | ALL | ALL | 0.0.0.0/0 | All outbound (Docker pulls, AWS API calls, etc.) |

**SSH restriction:** SSH is only allowed from one specific IP (your home/office). This is set via the `allowed_ssh_cidr` variable in `dev.tfvars`. Change it if your IP changes.

**Why allow HTTP + HTTPS on EC2?** CloudFlare connects to the origin server via HTTP or HTTPS. Even though CloudFlare terminates TLS for the user, it may send requests to the origin on either port depending on the SSL mode configuration.

#### RDS Security Group

**Purpose:** Locks down the database to only accept connections from the EC2 instance.

| Direction | Port | Protocol | Source | Purpose |
|-----------|------|----------|--------|---------|
| Ingress | 5432 | TCP | EC2 Security Group | PostgreSQL from EC2 only |

**No egress rules needed.** RDS is a managed service — AWS handles its outbound connectivity.

**Why reference EC2 SG instead of IP?** Security group references are dynamic. If the EC2 instance IP changes, the rule still works. It's also more secure — only instances in the EC2 SG can connect, not anything with that IP.

---

## Compute Module

### Purpose

Creates the EC2 instance, Elastic IP, and IAM role for running the FastAPI backend.

### EC2 Instance

| Property | Value | Rationale |
|----------|-------|-----------|
| AMI | Amazon Linux 2023 (latest, x86_64) | Modern, lightweight, free tier eligible |
| Instance Type | t2.micro | 1 vCPU, 1GB RAM, 750 hrs/month free |
| Root Volume | 8GB gp2 | Minimal (Docker images + app code) |
| Subnet | Public (10.0.1.0/24) | Needs internet access, receives traffic |
| Key Pair | User-specified | Pre-created in AWS console |
| User Data | user-data.sh (templated) | Bootstraps Docker + config on first boot |

**Why Amazon Linux 2023?** It's AWS's own Linux distribution, optimized for EC2. Pre-installed AWS CLI, good package manager (dnf), long-term support, and included in free tier.

**Why t2.micro?** Free tier gives 750 hours/month — enough to run 24/7. 1GB RAM is sufficient for a single FastAPI container serving <10 req/hour.

### Elastic IP (EIP)

**Purpose:** Gives the EC2 instance a static public IP that doesn't change when the instance stops/starts.

**Cost:** Free when attached to a running instance. $0.005/hour when detached (to discourage hoarding).

**Why needed:**
- CloudFlare DNS points to this IP
- Without EIP, the instance gets a new public IP on every restart
- EIP ensures DNS records stay valid

### IAM Role & Policies

The EC2 instance assumes an IAM role that grants it specific AWS permissions.

**Trust Policy:** Only `ec2.amazonaws.com` can assume this role (not users, not other services).

**Permissions:**

| Permission Group | Actions | Resources | Purpose |
|-----------------|---------|-----------|---------|
| SSM Read | `ssm:GetParameter`, `ssm:GetParameters`, `ssm:GetParametersByPath` | `arn:aws:ssm:{region}:*:parameter/schulte-app/*` | Read DB password and config from SSM at startup |
| CloudWatch Logs | `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` | `*` | Send application logs to CloudWatch |
| Cognito Describe | `cognito-idp:DescribeUserPool`, `cognito-idp:DescribeUserPoolClient` | Cognito User Pool ARN | Describe auth configuration (for JWT validation setup) |
| ECR Read | `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` | `*` | Pull Docker images from ECR (future use) |

**Least privilege:** The role cannot write to SSM, cannot modify Cognito users, cannot delete anything. It only reads what it needs.

### EC2 Bootstrap Script (user-data.sh)

Runs once on first boot. Logged to `/var/log/user-data.log`.

**Steps:**

1. **System update:** `dnf update -y`
2. **Install Docker:** `dnf install -y docker` → `systemctl enable --now docker`
3. **Docker permissions:** `usermod -aG docker ec2-user` (allows running docker without sudo)
4. **Install Docker Compose v2.24.5:** Downloads binary from GitHub, installs as Docker CLI plugin
5. **Install PostgreSQL 15 client:** For manual `psql` testing/debugging
6. **Install git:** For cloning the backend repo
7. **Create .env file:** Writes all config to `/home/ec2-user/.env` with restricted permissions (600)

**Environment variables written to .env:**

```bash
APP_ENVIRONMENT=dev
AWS_REGION=ap-southeast-1
DB_HOST={RDS endpoint}
DB_PORT=5432
DB_NAME=schulte
DB_USERNAME=schulte_admin
DB_PASSWORD_SSM_PATH=/schulte-app/dev/db-password
COGNITO_USER_POOL_ID={from Terraform output}
COGNITO_CLIENT_ID={from Terraform output}
COGNITO_REGION=ap-southeast-1
```

**Note:** The .env does NOT contain the actual DB password. It contains the SSM path. The application reads the actual password from SSM at startup using its IAM role. This way, the password never touches disk in plaintext.

---

## Database Module

### Purpose

Creates the RDS PostgreSQL instance, DB subnet group, and stores secrets in SSM Parameter Store.

### RDS Instance

| Property | Value | Rationale |
|----------|-------|-----------|
| Engine | PostgreSQL 15 | Stable, widely supported |
| Instance Class | db.t4g.micro | ARM-based, 2 vCPU, 1GB RAM, free tier eligible |
| Storage | 20GB gp2 | Free tier includes 20GB |
| Database Name | schulte | Initial database created on launch |
| Master Username | schulte_admin | Descriptive admin username |
| Master Password | Auto-generated (32 chars) | Random, stored in SSM |
| Multi-AZ | false | Dev only, saves cost |
| Publicly Accessible | false | Only reachable from EC2 via security group |
| Backup Retention | 0 days | Disabled for dev (saves storage cost) |
| Deletion Protection | false | Easy teardown for dev |
| Auto Minor Version | true | Stay current with security patches |
| Skip Final Snapshot | true | No snapshot needed on delete for dev |

**Why db.t4g.micro?** ARM-based (Graviton) instances are included in the free tier for RDS. 750 hours/month free. Same performance as t3.micro but $0 cost.

**Why NOT set max_allocated_storage?** Setting it enables auto-scaling, which can silently increase storage beyond free tier limits and incur charges. By not setting it, storage stays fixed at 20GB.

### DB Subnet Group

```
Name:    schulte-app-dev-db-subnet
Subnets: 10.0.10.0/24 (az-1a), 10.0.11.0/24 (az-1b)
```

AWS requires RDS instances to be placed in a subnet group spanning at least 2 AZs, even for single-AZ deployments. Both subnets are private (no internet access).

### Password Generation

```hcl
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}
```

**Why exclude some special characters?** Characters like `@`, `/`, `"`, `'`, and spaces can cause issues in connection strings and shell variable expansion. The allowed set is safe for all contexts.

### SSM Parameters

All stored under the path prefix `/schulte-app/{environment}/`.

| Parameter | Type | Path | Value |
|-----------|------|------|-------|
| DB Password | SecureString | `/schulte-app/dev/db-password` | Random 32-char password |
| DB Endpoint | String | `/schulte-app/dev/db-endpoint` | RDS host:port |
| DB Name | String | `/schulte-app/dev/db-name` | "schulte" |

**Why SSM over Secrets Manager?**
- SSM Standard parameters are **free** (up to 10,000 parameters)
- Secrets Manager charges **$0.40/secret/month** + API call charges
- For our use case (a few static secrets), SSM is functionally equivalent at zero cost

**SecureString encryption:** Uses the default AWS-managed KMS key (`aws/ssm`). Free for SSM encryption/decryption.

---

## Auth Module

### Purpose

Creates the Cognito User Pool (user directory) and User Pool Client (app configuration) for authentication.

### Cognito User Pool

| Property | Value | Rationale |
|----------|-------|-----------|
| Name | schulte-app-dev | Environment-specific |
| Login Attribute | email | Users log in with email address |
| Auto-Verified | email | Cognito sends verification code |
| MFA | OFF | Simplicity for MVP (can enable later) |
| Deletion Protection | INACTIVE | Dev environment, easy cleanup |
| Email Service | Cognito Default | 50 emails/day free (sufficient for dev) |

**Why email login (not username)?** Simpler UX. Users don't need to remember a separate username. Email is unique and verifiable.

**Why Cognito default email?** SES integration requires domain verification and moves out of sandbox. Cognito's built-in email is free for up to 50 emails/day — plenty for a dev environment.

### Password Policy

```
Minimum Length:    8 characters
Require Lowercase: Yes
Require Uppercase: Yes
Require Numbers:   Yes
Require Symbols:   No
```

**Why no symbols required?** Reduces friction for users while maintaining reasonable security. 8 chars with mixed case + numbers is sufficient for a training app.

### Account Recovery

```
Method:   verified_email
Priority: 1
```

Users reset their password via a code sent to their email. No phone/SMS recovery (avoids SNS costs).

### User Pool Client (Web/SPA)

| Property | Value | Rationale |
|----------|-------|-----------|
| Name | schulte-app-web | Identifies the client |
| Generate Secret | false | Public client (browser/SPA, no secret storage) |
| Prevent User Existence Errors | ENABLED | Returns generic errors (prevents email enumeration) |

**Auth Flows:**

| Flow | Purpose |
|------|---------|
| ALLOW_USER_PASSWORD_AUTH | Email + password login |
| ALLOW_REFRESH_TOKEN_AUTH | Token refresh without re-login |
| ALLOW_USER_SRP_AUTH | Secure Remote Password (client-side password hashing) |

**OAuth Configuration:**

```
Flow:        authorization_code
Scopes:      email, openid, profile
Providers:   COGNITO (+ Google, Apple to be added)
Callback:    http://localhost:3000/auth/callback (dev)
Logout:      http://localhost:3000 (dev)
```

**Token Validity:**

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 1 hour | Authenticates API requests |
| ID Token | 1 hour | Contains user profile claims |
| Refresh Token | 30 days | Gets new access/id tokens without re-login |

### Hosted UI Domain

```
Domain: schulte-app-dev
URL:    https://schulte-app-dev.auth.ap-southeast-1.amazoncognito.com
```

**Purpose:** Provides a hosted login/signup page for OAuth flows (especially social login). The frontend can redirect to this URL for Google/Apple authentication, and Cognito handles the entire OAuth dance.

### Social Login Setup (Google + Apple)

**Not yet configured in Terraform** — requires additional setup:

**Google:**
1. Create project in Google Cloud Console
2. Configure OAuth consent screen
3. Create OAuth 2.0 client credentials
4. Add Google as identity provider in Cognito
5. Update Terraform auth module with Google client ID + secret

**Apple:**
1. Enroll in Apple Developer Program
2. Create App ID with "Sign in with Apple" capability
3. Create Service ID
4. Generate private key
5. Add Apple as identity provider in Cognito
6. Update Terraform auth module with Apple team ID + key

**Terraform changes needed:** Add `aws_cognito_identity_provider` resources for Google and Apple, update `supported_identity_providers` in the user pool client.

---

## Security

### Network Security

```
Internet → CloudFlare (HTTPS) → EC2 (HTTP, port 80/443)
EC2 → RDS (port 5432, security group reference)
RDS → nothing (no outbound, no internet)
SSH → EC2 (port 22, restricted to single IP)
```

**Defense in depth:**
- CloudFlare provides DDoS protection and WAF rules (free tier)
- EC2 security group limits ingress to ports 22/80/443
- RDS security group only accepts connections from EC2
- Private subnets have no internet route
- SSH restricted to a single IP address

### Secret Management

| Secret | Storage | Access Method |
|--------|---------|---------------|
| DB Password | SSM SecureString | IAM role → `ssm:GetParameter` |
| DB Endpoint | SSM String | IAM role → `ssm:GetParameter` |
| Cognito IDs | EC2 .env file | Environment variable |
| Terraform State | S3 (encrypted, versioned) | AWS profile |

**What's NOT in source control:**
- `terraform.tfvars` (gitignored, contains user-specific values)
- `.tfstate` files (stored in S3)
- `.terraform/` directory (downloaded plugins)
- `.env` files (generated by user-data script)

### IAM Least Privilege

The EC2 role can only:
- **Read** SSM parameters under `/schulte-app/*`
- **Write** CloudWatch logs
- **Describe** Cognito resources (read-only)
- **Pull** ECR images (read-only, future use)

It **cannot:**
- Write to SSM (can't change secrets)
- Modify Cognito users (can't grant/revoke access)
- Access S3 buckets
- Create/delete any AWS resources

---

## Deployment Flow

### Prerequisites

1. AWS account with 12-month free tier active
2. Terraform >= 1.5 installed
3. AWS CLI installed and configured
4. EC2 key pair created in ap-southeast-1 (via AWS Console)

### Step 1: Configure AWS CLI

```bash
aws configure --profile schulte-dev
# AWS Access Key ID: (your key)
# AWS Secret Access Key: (your secret)
# Default region: ap-southeast-1
# Default output: json
```

### Step 2: Bootstrap (Run Once)

```bash
cd infrastructure/awsenv/bootstrap
terraform init
terraform apply -var-file=bootstrap.tfvars
```

**Creates:** S3 bucket + DynamoDB table for Terraform state.

**After running:** Copy the `state_bucket_name` output value and update `backend.tf` in `env/dev/`.

### Step 3: Edit dev.tfvars

```hcl
aws_profile       = "schulte-dev"
allowed_ssh_cidr  = "YOUR_PUBLIC_IP/32"     # Find at https://whatismyip.com
ec2_key_pair_name = "your-key-pair-name"     # Created in step 1.4
```

### Step 4: Deploy Main Infrastructure

```bash
cd infrastructure/awsenv/env/dev
terraform init
terraform plan -var-file=dev.tfvars    # Review changes
terraform apply -var-file=dev.tfvars   # Create resources
```

**Creates:** VPC, subnets, security groups, EC2, EIP, RDS, Cognito. Takes ~10-15 minutes (RDS creation is slow).

### Step 5: Verify

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ec2-user@$(terraform output -raw ec2_public_ip)

# Verify Docker is running
docker --version
docker compose version

# Verify DB connectivity (from EC2)
PGPASSWORD=$(aws ssm get-parameter --name /schulte-app/dev/db-password --with-decryption --query Parameter.Value --output text --region ap-southeast-1) \
psql -h $(terraform output -raw rds_endpoint | cut -d: -f1) -U schulte_admin -d schulte
```

### Step 6: Deploy Backend (Manual for MVP)

```bash
# On your local machine
cd backend
docker build -t schulte-api .
docker save schulte-api | gzip > schulte-api.tar.gz
scp -i ~/.ssh/your-key.pem schulte-api.tar.gz ec2-user@EC2_IP:~

# On EC2
ssh -i ~/.ssh/your-key.pem ec2-user@EC2_IP
docker load < schulte-api.tar.gz
docker compose up -d
```

---

## Terraform Variables Reference

### Bootstrap Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `aws_profile` | string | - | AWS CLI profile name |
| `aws_region` | string | ap-southeast-1 | AWS region |
| `project_name` | string | schulte-app | Project prefix for resource names |

### Dev Environment Variables

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `aws_region` | string | ap-southeast-1 | No | AWS region |
| `aws_profile` | string | - | **Yes** | AWS CLI profile |
| `environment` | string | dev | No | Environment name |
| `project_name` | string | schulte-app | No | Project prefix |
| `vpc_cidr` | string | 10.0.0.0/16 | No | VPC CIDR block |
| `public_subnet_cidr` | string | 10.0.1.0/24 | No | EC2 subnet |
| `private_subnet_cidrs` | list(string) | [10.0.10.0/24, 10.0.11.0/24] | No | RDS subnets |
| `availability_zones` | list(string) | [1a, 1b] | No | AZs for subnets |
| `allowed_ssh_cidr` | string | - | **Yes** | Your IP/32 for SSH |
| `ec2_instance_type` | string | t2.micro | No | EC2 size |
| `ec2_key_pair_name` | string | - | **Yes** | Pre-created key pair |
| `db_instance_class` | string | db.t4g.micro | No | RDS size |
| `db_engine_version` | string | 15 | No | PostgreSQL version |
| `db_name` | string | schulte | No | Database name |
| `db_username` | string | schulte_admin | No | DB admin user |
| `db_allocated_storage` | number | 20 | No | GB of storage |
| `cognito_callback_urls` | list(string) | [localhost:3000/auth/callback] | No | OAuth callbacks |
| `cognito_logout_urls` | list(string) | [localhost:3000] | No | Post-logout URLs |

---

## Terraform Outputs

After `terraform apply`, these values are available:

| Output | Example | Used By |
|--------|---------|---------|
| `ec2_public_ip` | 54.169.x.x | CloudFlare DNS, SSH |
| `ec2_instance_id` | i-0abc123 | AWS Console |
| `ssh_command` | `ssh -i ~/.ssh/key.pem ec2-user@54.169.x.x` | Developer |
| `rds_endpoint` | schulte-dev.abc123.rds.amazonaws.com:5432 | Backend .env |
| `rds_db_name` | schulte | Backend .env |
| `ssm_db_password_path` | /schulte-app/dev/db-password | Backend config |
| `cognito_user_pool_id` | ap-southeast-1_AbCdEf | Backend JWT validation |
| `cognito_user_pool_client_id` | 1abc2def3ghi4jkl | Frontend + backend auth |
| `cognito_domain` | schulte-app-dev | OAuth hosted UI |
| `cognito_issuer_url` | https://cognito-idp.ap-southeast-1.amazonaws.com/... | JWT issuer verification |

---

## Cost Summary

### Within Free Tier (First 12 Months)

| Service | Free Tier Allowance | Our Usage | Monthly Cost |
|---------|--------------------|-----------|----|
| EC2 t2.micro | 750 hrs/month | 730 hrs (24/7) | $0 |
| EBS gp2 | 30 GB | 8 GB | $0 |
| RDS db.t4g.micro | 750 hrs/month | 730 hrs | $0 |
| RDS Storage | 20 GB | 20 GB | $0 |
| Elastic IP | 1 free (attached) | 1 | $0 |
| Cognito | 50,000 MAU | <100 MAU | $0 |
| SSM Standard | 10,000 params | 3 params | $0 |
| S3 | 5 GB | <1 MB (TF state) | $0 |
| DynamoDB | 25 GB + 25 WCU/RCU | <1 MB, ~0 ops | $0 |
| Data Transfer | 100 GB out/month | <1 GB | $0 |
| **Total** | | | **$0** |

### After Free Tier Expires

| Service | Monthly Cost |
|---------|-------------|
| EC2 t2.micro (on-demand) | ~$8.50 |
| EBS 8GB gp2 | ~$0.80 |
| RDS db.t4g.micro | ~$12.50 |
| RDS 20GB storage | ~$2.30 |
| Elastic IP | $0 (attached) |
| Cognito <50K MAU | $0 |
| SSM | $0 |
| S3 + DynamoDB | ~$0.10 |
| **Total** | **~$24/month** |

**Optimization options when free tier expires:**
- Reserved instances (EC2 + RDS): ~40% savings
- Spot instances for EC2: ~70% savings (with interruption risk)
- Stop instances during off-hours: proportional savings
- Downgrade RDS to db.t4g.nano if available

---

## Teardown

To destroy all infrastructure (development only):

```bash
# Main infrastructure
cd infrastructure/awsenv/env/dev
terraform destroy -var-file=dev.tfvars

# Bootstrap (optional, can keep for future use)
cd infrastructure/awsenv/bootstrap
terraform destroy -var-file=bootstrap.tfvars
```

**Warning:** This deletes everything including the database and all its data. RDS `skip_final_snapshot = true` means no backup is created on deletion. This is intentional for dev — production should have `deletion_protection = true` and `skip_final_snapshot = false`.
