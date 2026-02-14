# =============================================================================
# Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Compute
# -----------------------------------------------------------------------------

output "ec2_public_ip" {
  description = "Elastic IP of the EC2 instance — point your DNS here"
  value       = module.compute.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = module.compute.instance_id
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = "ssh -i ~/.ssh/${var.ec2_key_pair_name}.pem ec2-user@${module.compute.public_ip}"
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS endpoint (host:port)"
  value       = module.database.db_endpoint
}

output "rds_db_name" {
  description = "Database name"
  value       = module.database.db_name
}

output "ssm_db_password_path" {
  description = "SSM parameter path for the DB password"
  value       = module.database.ssm_db_password_path
}

# -----------------------------------------------------------------------------
# Auth (Cognito)
# -----------------------------------------------------------------------------

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID (for frontend)"
  value       = module.auth.user_pool_client_id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = "https://${module.auth.user_pool_domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_issuer_url" {
  description = "Cognito issuer URL (for JWT validation in backend)"
  value       = "https://${module.auth.user_pool_endpoint}"
}
