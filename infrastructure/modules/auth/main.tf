# =============================================================================
# Auth: Cognito User Pool + Client
# =============================================================================
# Always free: 50,000 MAU
# =============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  # Login with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  # Account recovery via email
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Use Cognito default email (free, 50 emails/day — fine for dev)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Schema
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 255
    }
  }

  # MFA off for dev simplicity
  mfa_configuration = "OFF"

  # Allow deletion in dev
  deletion_protection = "INACTIVE"

  tags = {
    Name = "${var.project_name}-${var.environment}-user-pool"
  }
}

# -----------------------------------------------------------------------------
# User Pool Client (public — no secret, for SPA/PWA)
# -----------------------------------------------------------------------------

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client (no secret for browser apps)
  generate_secret = false

  # Auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  # Start with Cognito only; add Google/Apple later
  supported_identity_providers = ["COGNITO"]

  # OAuth settings
  callback_urls                        = var.cognito_callback_urls
  logout_urls                          = var.cognito_logout_urls
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Security: don't reveal whether email is registered
  prevent_user_existence_errors = "ENABLED"
}

# -----------------------------------------------------------------------------
# User Pool Domain (hosted UI)
# -----------------------------------------------------------------------------

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}
