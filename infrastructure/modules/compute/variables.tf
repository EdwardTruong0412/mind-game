variable "ec2_instance_type" {
  description = "EC2 instance type (t2.micro = free tier)"
  type        = string
}

variable "ec2_key_pair_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
}

variable "public_subnet_id" {
  description = "ID of the public subnet to place EC2 in"
  type        = string
}

variable "ec2_security_group_id" {
  description = "Security group ID for the EC2 instance"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

# Database info (for user-data template)
variable "db_address" {
  description = "RDS hostname"
  type        = string
}

variable "db_port" {
  description = "RDS port"
  type        = number
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "ssm_db_password_path" {
  description = "SSM parameter path for DB password"
  type        = string
}

# Cognito info (for user-data template)
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN (for IAM policy)"
  type        = string
}
