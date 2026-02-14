# =============================================================================
# Compute Module (EC2)
# =============================================================================

module "compute" {
  source = "../../../modules/compute"

  ec2_instance_type     = var.ec2_instance_type
  ec2_key_pair_name     = var.ec2_key_pair_name
  public_subnet_id      = module.networking.public_subnet_id
  ec2_security_group_id = module.networking.ec2_security_group_id
  project_name          = var.project_name
  environment           = var.environment
  aws_region            = var.aws_region

  # Database info for user-data
  db_address           = module.database.db_address
  db_port              = module.database.db_port
  db_name              = var.db_name
  db_username          = var.db_username
  ssm_db_password_path = module.database.ssm_db_password_path

  # Cognito info for user-data
  cognito_user_pool_id  = module.auth.user_pool_id
  cognito_client_id     = module.auth.user_pool_client_id
  cognito_user_pool_arn = module.auth.user_pool_arn
}
