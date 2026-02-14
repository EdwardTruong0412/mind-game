# =============================================================================
# Input Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------

variable "aws_profile" {
  description = "AWS CLI profile name (from: aws configure --profile <name>)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "schulte-app"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (2 required for RDS subnet group)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "allowed_ssh_cidr" {
  description = "Your IP address in CIDR format for SSH access (e.g. 1.2.3.4/32). Run: curl ifconfig.me"
  type        = string
}

# -----------------------------------------------------------------------------
# Compute (EC2)
# -----------------------------------------------------------------------------

variable "ec2_instance_type" {
  description = "EC2 instance type (t2.micro = free tier)"
  type        = string
  default     = "t2.micro"
}

variable "ec2_key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

# -----------------------------------------------------------------------------
# Database (RDS)
# -----------------------------------------------------------------------------

variable "db_instance_class" {
  description = "RDS instance class (db.t4g.micro = free tier)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "schulte"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "schulte_admin"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB (20 = free tier max)"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# Auth (Cognito)
# -----------------------------------------------------------------------------

variable "cognito_callback_urls" {
  description = "Allowed callback URLs for Cognito auth"
  type        = list(string)
  default     = ["http://localhost:3000/auth/callback"]
}

variable "cognito_logout_urls" {
  description = "Allowed logout URLs for Cognito"
  type        = list(string)
  default     = ["http://localhost:3000"]
}
