# =============================================================================
# Database: RDS PostgreSQL + SSM Parameters
# =============================================================================
# Free tier: db.t4g.micro, 750 hrs/month, 20GB storage (12 months)
# =============================================================================

# -----------------------------------------------------------------------------
# Auto-generate DB password (stored in SSM, never in tfvars)
# -----------------------------------------------------------------------------

resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# DB Subnet Group (requires subnets in at least 2 AZs)
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}"

  # Engine
  engine         = "postgres"
  engine_version = var.db_engine_version

  # Instance (free tier)
  instance_class = var.db_instance_class

  # Storage (20GB gp2 = free tier max)
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp2"
  # Do NOT set max_allocated_storage — prevents auto-growth charges

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = coalesce(var.db_password, random_password.db.result)

  # Networking
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false
  multi_az               = false

  # Backups (disabled for dev to stay within free tier)
  backup_retention_period = 0
  skip_final_snapshot     = true

  # Maintenance
  auto_minor_version_upgrade = true
  apply_immediately          = true

  # Dev settings
  deletion_protection          = false
  performance_insights_enabled = false
  monitoring_interval          = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

# -----------------------------------------------------------------------------
# SSM Parameters (free — Standard tier, up to 10,000 params)
# -----------------------------------------------------------------------------

resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.project_name}/${var.environment}/db-password"
  description = "RDS master password"
  type        = "SecureString"
  value       = coalesce(var.db_password, random_password.db.result)

  tags = {
    Name = "${var.project_name}-${var.environment}-db-password"
  }
}

resource "aws_ssm_parameter" "db_endpoint" {
  name        = "/${var.project_name}/${var.environment}/db-endpoint"
  description = "RDS endpoint (host:port)"
  type        = "String"
  value       = aws_db_instance.main.endpoint

  tags = {
    Name = "${var.project_name}-${var.environment}-db-endpoint"
  }
}

resource "aws_ssm_parameter" "db_name" {
  name        = "/${var.project_name}/${var.environment}/db-name"
  description = "Database name"
  type        = "String"
  value       = var.db_name

  tags = {
    Name = "${var.project_name}-${var.environment}-db-name"
  }
}
