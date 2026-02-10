output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.main.public_ip
}

output "instance_public_dns" {
  description = "EC2 public DNS name"
  value       = aws_instance.main.public_dns
}
