# =============================================================================
# Bootstrap Variables
# =============================================================================

variable "aws_profile" {
  description = "AWS CLI profile name (from: aws configure --profile <name>)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "schulte-app"
}
