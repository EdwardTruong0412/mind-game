# =============================================================================
# Schulte App — Dev Environment
# =============================================================================
# Free-tier AWS infrastructure: EC2 + RDS + Cognito
# Estimated cost: $0/month (within 12-month free tier)
# =============================================================================
# IMPORTANT: Update the bucket name after running bootstrap/main.tf
# The bucket name follows the pattern: schulte-app-tf-state-{ACCOUNT_ID}
# =============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "schulte-app-tf-state-977099017069"
    key            = "dev/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "schulte-app-tf-locks"
    encrypt        = true
    profile        = "schulte_table"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
