# Billing Management Platform API Documentation

## Authentication
All API routes require authentication unless specified otherwise.

## Subscription API
- `GET /api/subscriptions` - List all subscriptions
- `POST /api/subscriptions` - Create a new subscription
- `PUT /api/subscriptions` - Update existing subscription

## Usage API
- `POST /api/usage` - Record usage for a subscription feature
- `GET /api/usage?subscriptionId=xxx` - Get usage records

## Analytics API
- `GET /api/analytics?organizationId=xxx` - Get analytics for an organization

## Reports API
- `GET /api/reports?type=xxx&format=xxx` - Generate reports in different formats
