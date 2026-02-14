# =============================================================================
# Dev Environment Variables
# =============================================================================
# Usage: terraform apply -var-file=dev.tfvars
# =============================================================================

# AWS CLI profile (setup: aws configure --profile schulte-dev)
aws_profile = "schulte_table"

# Your IP for SSH access (run: curl ifconfig.me)
allowed_ssh_cidr = "116.97.107.23/32"

# EC2 key pair name (create first: aws ec2 create-key-pair --key-name schulte-key --region ap-southeast-1 --query 'KeyMaterial' --output text > ~/.ssh/schulte-key.pem && chmod 400 ~/.ssh/schulte-key.pem)
ec2_key_pair_name = "schulte_table"

# Cognito callback URLs
cognito_callback_urls = ["https://schulte.imaprof.ink/auth/callback", "http://localhost:3000/auth/callback"]
cognito_logout_urls   = ["https://schulte.imaprof.ink", "http://localhost:3000"]

