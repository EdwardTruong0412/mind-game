# =============================================================================
# Auth Module (Cognito)
# =============================================================================

module "auth" {
  source = "../../../modules/auth"

  project_name          = var.project_name
  environment           = var.environment
  cognito_callback_urls = var.cognito_callback_urls
  cognito_logout_urls   = var.cognito_logout_urls
}
