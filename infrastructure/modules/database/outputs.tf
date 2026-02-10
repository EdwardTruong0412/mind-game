output "db_endpoint" {
  description = "RDS endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "RDS hostname (without port)"
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.main.db_name
}

output "db_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "ssm_db_password_path" {
  description = "SSM parameter path for DB password"
  value       = aws_ssm_parameter.db_password.name
}

output "ssm_db_endpoint_path" {
  description = "SSM parameter path for DB endpoint"
  value       = aws_ssm_parameter.db_endpoint.name
}
