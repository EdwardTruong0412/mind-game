# =============================================================================
# Networking Module
# =============================================================================

module "networking" {
  source = "../../../modules/networking"

  vpc_cidr             = var.vpc_cidr
  public_subnet_cidr   = var.public_subnet_cidr
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
  allowed_ssh_cidr     = var.allowed_ssh_cidr
  project_name         = var.project_name
  environment          = var.environment
}
