# Deployed AWS Resources — Dev Environment

Region: **ap-southeast-1 (Singapore)**
Account: **977099017069**
Profile: **schulte_table**

---

## 1. Networking — VPC & Subnets

| Resource | Name | Console Path |
|----------|------|--------------|
| VPC | `schulte-app-dev-vpc` | VPC → Your VPCs |
| Internet Gateway | `schulte-app-dev-igw` | VPC → Internet Gateways |
| Public Subnet | `schulte-app-dev-public-ap-southeast-1a` | VPC → Subnets |
| Private Subnet 1 | `schulte-app-dev-private-ap-southeast-1a` | VPC → Subnets |
| Private Subnet 2 | `schulte-app-dev-private-ap-southeast-1b` | VPC → Subnets |
| Public Route Table | `schulte-app-dev-public-rt` | VPC → Route Tables |
| Private Route Table | `schulte-app-dev-private-rt` | VPC → Route Tables |

---

## 2. Security Groups

| Resource | Name | Rules |
|----------|------|-------|
| EC2 Security Group | `schulte-app-dev-ec2-sg` | Inbound: SSH (22) from `116.97.107.23/32`, HTTP (80) all, HTTPS (443) all |
| RDS Security Group | `schulte-app-dev-rds-sg` | Inbound: PostgreSQL (5432) from EC2 SG only |

Console path: VPC → Security Groups

---

## 3. Compute — EC2

| Resource | Value | Console Path |
|----------|-------|--------------|
| EC2 Instance | `schulte-app-dev-api` | EC2 → Instances |
| Instance Type | `t2.micro` (free tier) | — |
| AMI | Amazon Linux 2023 (latest) | — |
| EBS Volume | 30 GB gp2 (free tier max) | EC2 → Volumes |
| Key Pair | `schulte_table` | EC2 → Key Pairs |
| Elastic IP | attached to EC2 | EC2 → Elastic IPs |
| IAM Role | `schulte-app-dev-ec2-role` | IAM → Roles |
| IAM Instance Profile | `schulte-app-dev-ec2-profile` | IAM → Roles |

**Things to verify:**
- Instance state is `running`
- Elastic IP is associated (not detached)
- Status checks: both `2/2 checks passed`

---

## 4. Database — RDS PostgreSQL

| Resource | Value | Console Path |
|----------|-------|--------------|
| RDS Instance | `schulte-app-dev` | RDS → Databases |
| Engine | PostgreSQL 15 | — |
| Instance Class | `db.t4g.micro` (free tier) | — |
| Storage | 20 GB gp2 (free tier max) | — |
| DB Name | `schulte` | — |
| DB Username | `schulte_admin` | — |
| DB Subnet Group | `schulte-app-dev-db-subnet` | RDS → Subnet Groups |
| Publicly Accessible | No (private subnet only) | — |
| Multi-AZ | No | — |

**Things to verify:**
- Status is `Available`
- Not publicly accessible
- In the correct VPC

---

## 5. SSM Parameter Store

| Parameter Path | Type | Console Path |
|---------------|------|--------------|
| `/schulte-app/dev/db-password` | SecureString | Systems Manager → Parameter Store |
| `/schulte-app/dev/db-endpoint` | String | Systems Manager → Parameter Store |
| `/schulte-app/dev/db-name` | String | Systems Manager → Parameter Store |

**Things to verify:**
- All 3 parameters exist
- `db-password` type is `SecureString` (not plain String)

---

## 6. Auth — Cognito

| Resource | Value | Console Path |
|----------|-------|--------------|
| User Pool | `schulte-app-dev` | Cognito → User Pools |
| User Pool Client | `schulte-app-web` | Cognito → User Pools → App Clients |
| Hosted UI Domain | `schulte-app-dev.auth.ap-southeast-1.amazoncognito.com` | Cognito → User Pools → App Integration |
| Login with | Email only | — |
| MFA | Off | — |

**Things to verify:**
- User pool status is `Active`
- App client exists with no secret (public client)
- Domain is created under App Integration tab

---

## 7. Terraform State — Bootstrap (created separately)

| Resource | Name | Console Path |
|----------|------|--------------|
| S3 Bucket | `schulte-app-tf-state-977099017069` | S3 |
| DynamoDB Table | `schulte-app-tf-locks` | DynamoDB → Tables |

**Things to verify:**
- S3 bucket has versioning enabled
- DynamoDB table exists with `LockID` as the partition key

---

## Terraform Outputs

After a successful apply, run the following to see actual values:

```bash
cd infrastructure/awsenv/env/dev
terraform output
```

Key outputs:
- `ec2_public_ip` — point CloudFlare DNS here
- `ssh_command` — ready-to-use SSH command
- `rds_endpoint` — DB host:port
- `cognito_user_pool_id` — needed for frontend config
- `cognito_user_pool_client_id` — needed for frontend config
- `cognito_domain` — hosted UI base URL

---

## Quick Health Check

```bash
# 1. SSH into EC2 (replace IP with terraform output ec2_public_ip)
ssh -i ~/.ssh/schulte_table.pem ec2-user@<EC2_PUBLIC_IP>

# 2. Check Docker is running
docker --version
docker compose version

# 3. Check .env was written by user-data
cat /home/ec2-user/.env
```
