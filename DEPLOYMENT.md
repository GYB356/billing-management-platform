# Deployment Guide

This guide explains how to deploy the Invoice Management System to production.

## Prerequisites

- Node.js 18.x or later
- Docker and Docker Compose
- AWS Account with appropriate permissions
- Domain name (for SSL/TLS)

## Environment Variables

Create a `.env` file in both the server and client directories:

### Server Environment Variables
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://mongo:27017/invoice-system
REDIS_URL=redis://redis:6379
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=7d
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=your-aws-region
```

### Client Environment Variables
```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
```

## Production Build

1. Build Docker images:
```bash
# Build server image
docker build -t invoice-server -f server/Dockerfile.prod ./server

# Build client image
docker build -t invoice-client -f client/Dockerfile.prod ./client
```

2. Push to container registry (example using AWS ECR):
```bash
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker tag invoice-server:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/invoice-server:latest
docker tag invoice-client:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/invoice-client:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/invoice-server:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/invoice-client:latest
```

## Infrastructure Setup

### AWS ECS Setup

1. Create ECS Cluster:
```bash
aws ecs create-cluster --cluster-name invoice-system
```

2. Create Task Definitions:
```bash
aws ecs register-task-definition --cli-input-json file://task-definitions/server.json
aws ecs register-task-definition --cli-input-json file://task-definitions/client.json
```

3. Create Services:
```bash
aws ecs create-service \
  --cluster invoice-system \
  --service-name invoice-server \
  --task-definition invoice-server \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-1,subnet-2],securityGroups=[sg-123]}"

aws ecs create-service \
  --cluster invoice-system \
  --service-name invoice-client \
  --task-definition invoice-client \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-1,subnet-2],securityGroups=[sg-123]}"
```

### Database Setup

1. Create MongoDB Atlas cluster or use AWS DocumentDB:
```bash
# Example using MongoDB Atlas
mongodb+srv://username:password@cluster.mongodb.net/invoice-system
```

2. Set up Redis for caching:
```bash
# Example using AWS ElastiCache
aws elasticache create-cache-cluster \
  --cache-cluster-id invoice-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

### Load Balancer and SSL

1. Create Application Load Balancer:
```bash
aws elbv2 create-load-balancer \
  --name invoice-alb \
  --subnets subnet-1 subnet-2 \
  --security-groups sg-123
```

2. Add SSL Certificate:
```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS

# Add CNAME record to your DNS
```

## Monitoring and Logging

1. Set up CloudWatch:
```bash
aws logs create-log-group --log-group-name /ecs/invoice-system

aws ecs update-service \
  --cluster invoice-system \
  --service invoice-server \
  --enable-execute-command
```

2. Set up monitoring alerts:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name invoice-system-cpu \
  --alarm-description "CPU utilization high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow for CI/CD. To use it:

1. Add secrets to GitHub repository:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REPOSITORY
```

2. Push to main branch to trigger deployment:
```bash
git push origin main
```

## Backup and Recovery

1. Set up MongoDB backups:
```bash
# Using MongoDB Atlas
# Automated backups are enabled by default
```

2. Set up S3 bucket for file backups:
```bash
aws s3 mb s3://invoice-system-backups

# Set up lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket invoice-system-backups \
  --lifecycle-configuration file://lifecycle.json
```

## Health Checks

The application includes built-in health checks:

- `/api/health` - API health check
- `/health` - Frontend health check

Monitor these endpoints using CloudWatch:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name api-health \
  --alarm-description "API health check failed" \
  --metric-name HealthCheckStatus \
  --namespace AWS/Route53 \
  --statistic Minimum \
  --period 60 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1
```

## Rollback Procedure

In case of deployment issues:

1. Rollback ECS task definition:
```bash
aws ecs update-service \
  --cluster invoice-system \
  --service invoice-server \
  --task-definition invoice-server:previous-version
```

2. Rollback database (if needed):
```bash
# Using MongoDB Atlas
# Restore from the latest backup point
```

## Security Considerations

1. Enable AWS WAF:
```bash
aws waf create-web-acl \
  --name invoice-system \
  --metric-name InvoiceSystem \
  --default-action Block
```

2. Set up AWS Shield (if needed):
```bash
aws shield create-protection \
  --name invoice-system \
  --resource-arn $ALB_ARN
```

3. Regular security updates:
```bash
# Update base images regularly
docker pull node:18-alpine
docker build --no-cache -t invoice-server -f server/Dockerfile.prod ./server
```

## Performance Optimization

1. Enable CloudFront CDN:
```bash
aws cloudfront create-distribution \
  --origin-domain-name your-alb-domain \
  --default-root-object index.html
```

2. Set up auto-scaling:
```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/invoice-system/invoice-server \
  --min-capacity 2 \
  --max-capacity 10
```

## Troubleshooting

Common issues and solutions:

1. Container health check failing:
```bash
# Check container logs
aws logs get-log-events \
  --log-group-name /ecs/invoice-system \
  --log-stream-name container/invoice-server/latest
```

2. Database connection issues:
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-123
```

3. SSL certificate issues:
```bash
# Verify certificate status
aws acm describe-certificate \
  --certificate-arn $CERT_ARN
```

## Support and Maintenance

For production support:

1. Set up monitoring alerts to Slack/Email
2. Establish on-call rotation
3. Maintain runbook for common issues
4. Regular security patches and updates
5. Periodic load testing and performance optimization

## Useful Commands

```bash
# View service logs
aws logs tail /ecs/invoice-system --follow

# Scale service
aws ecs update-service --cluster invoice-system --service invoice-server --desired-count 4

# Check task status
aws ecs describe-tasks --cluster invoice-system --tasks $TASK_ID

# Connect to container
aws ecs execute-command --cluster invoice-system --task $TASK_ID --container invoice-server --command "/bin/sh"
``` 