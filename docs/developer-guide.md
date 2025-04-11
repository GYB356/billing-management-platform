# Developer Guide

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (for metrics collection)

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables: Copy `.env.example` to `.env` and fill in required values
4. Run database migrations: `npx prisma migrate dev`
5. Start the development server: `npm run dev`

## Architecture

### Core Services

#### Subscription Management
The subscription system handles plan selection, billing cycles, and subscription status changes.

Key files:
- `/app/api/subscriptions/route.ts` - API endpoints
- `/lib/services/subscription-service.ts` - Business logic

#### Usage Tracking
Tracks feature usage and applies it to billing.

#### Multi-Currency Support
Handles currency conversion and localized pricing.

## Extending the Platform

### Adding a New Feature
1. Define the feature in the database schema
2. Implement usage tracking endpoints
3. Update subscription plans to include the feature
4. Add UI components for feature management

### Creating Custom Reports
Use the report templates in `/lib/reports/templates.ts` as a base for custom reports.
