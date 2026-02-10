# =============================================================================
# Bootstrap Variables — safe to commit (no sensitive values)
# =============================================================================
# Usage: terraform apply -var-file=bootstrap.tfvars
# =============================================================================

# AWS CLI profile (setup: aws configure --profile schulte-dev)
aws_profile  = "schulte-dev"

aws_region   = "ap-southeast-1"
project_name = "schulte-app"
