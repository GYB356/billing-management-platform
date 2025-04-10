# API Reference

## Authentication
All API endpoints require authentication via Bearer token unless specified otherwise.

## Subscriptions
### Create Subscription
`POST /api/subscriptions`

**Request Body**
```json
{
  "planId": "string",
  "organizationId": "string",
  "paymentMethodId": "string (optional)",
  "trialDays": "number (optional)"
}
```

**Response**
```json
{
  "subscription": {
    "id": "string",
    "status": "string",
    "currentPeriodEnd": "date"
  },
  "clientSecret": "string (optional)"
}
```

### Get Subscriptions
`GET /api/subscriptions?organizationId=xxx`

## Usage Tracking
`POST /api/usage`

## Analytics
`GET /api/analytics?organizationId=xxx&period=month`
