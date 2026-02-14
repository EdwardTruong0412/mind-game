# =============================================================================
# Database Module (RDS PostgreSQL)
# =============================================================================

module "database" {
  source = "../../../modules/database"

  private_subnet_ids    = module.networking.private_subnet_ids
  rds_security_group_id = module.networking.rds_security_group_id
  db_instance_class     = var.db_instance_class
  db_engine_version     = var.db_engine_version
  db_name               = var.db_name
  db_username           = var.db_username
  db_allocated_storage  = var.db_allocated_storage
  project_name          = var.project_name
  environment           = var.environment
}
