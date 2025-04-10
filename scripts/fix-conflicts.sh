#!/bin/bash

echo "Resolving merge conflicts..."

# Fix .env conflicts (keep local changes with new environment variables)
cat > /workspaces/billing-management-platform/.env << 'EOL'
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/billing-platform?schema=public"

# Auth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SECURE=false
EMAIL_FROM=noreply@yourdomain.com

# Redis Configuration for Metrics
REDIS_URL=redis://localhost:6379

# Report Storage
REPORT_STORAGE_PATH=/path/to/reports

# Additional Analytics Services
POSTHOG_API_KEY=your_posthog_api_key
INTERCOM_ACCESS_TOKEN=your_intercom_access_token
CHARTMOGUL_API_KEY=your_chartmogul_api_key
CHARTMOGUL_DATA_SOURCE_ID=your_chartmogul_data_source_id
PROFITWELL_API_KEY=your_profitwell_api_key

# Enhanced Metrics Configuration
METRICS_RETENTION_DAYS=90
ENABLE_PREDICTIVE_METRICS=true
ENABLE_SECURITY_METRICS=true

# External Analytics Services
SEGMENT_WRITE_KEY=your_segment_write_key
AMPLITUDE_API_KEY=your_amplitude_api_key
MIXPANEL_TOKEN=your_mixpanel_token

# Webhook Configuration
WEBHOOK_SECRET_KEY="your-webhook-secret-key"
EOL

# Accept our version of schema.prisma with the new models
cat > /workspaces/billing-management-platform/prisma/schema.prisma << 'EOL'
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Existing models
model User {
  id          String   @id @default(cuid())
  name        String?
  email       String   @unique
  password    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // ...existing fields...
}

// New models added for billing platform
model Organization {
  id              String   @id @default(cuid())
  name            String
  email           String?
  stripeCustomerId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ...relationships...
}

model Subscription {
  id                 String   @id @default(cuid())
  organizationId     String
  planId             String
  status             String
  stripeSubscriptionId String?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)
  trialEndsAt        DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  // ...relationships...
}

model Plan {
  id           String   @id @default(cuid())
  name         String
  description  String?
  price        Float
  currency     String   @default("USD")
  interval     String   @default("month")
  stripePriceId String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  // ...relationships...
}

model Invoice {
  id             String   @id @default(cuid())
  organizationId String
  amount         Float
  currency       String   @default("USD")
  status         String
  stripeInvoiceId String?
  pdfUrl         String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  // ...relationships...
}

model UsageRecord {
  id             String   @id @default(cuid())
  subscriptionId String
  featureId      String
  quantity       Float
  timestamp      DateTime @default(now())
  // ...relationships...
}

model Report {
  id          String   @id @default(cuid())
  type        String
  format      String
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  downloadUrl String?
  metadata    Json?
}

model Metric {
  id        String   @id @default(cuid())
  name      String
  value     Float
  timestamp DateTime @default(now())
  tags      Json?
}

model EmailNotification {
  id        String    @id @default(cuid())
  type      String
  status    String
  to        String
  subject   String
  body      String
  sentAt    DateTime?
  createdAt DateTime  @default(now())
  metadata  Json?
}

model Webhook {
  id            String   @id @default(cuid())
  organizationId String
  url           String
  events        String[]
  secret        String
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model WebhookDelivery {
  id         String   @id @default(cuid())
  webhookId  String
  payload    Json
  status     String
  statusCode Int?
  response   String?
  error      String?
  retries    Int      @default(0)
  createdAt  DateTime @default(now())
}

// Additional models can be added here
EOL

# Accept our version of package.json with all dependencies
cat > /workspaces/billing-management-platform/package.json << 'EOL'
{
  "name": "billing-management-platform",
  "version": "1.0.0",
  "description": "A comprehensive billing and subscription management platform",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "verify": "bash ./scripts/verify-implementation.sh",
    "fix-routes": "bash ./scripts/fix-routes.sh"
  },
  "dependencies": {
    "@amplitude/analytics-node": "^1.1.0",
    "@auth/prisma-adapter": "^1.0.0",
    "@segment/analytics-node": "^1.0.0",
    "@tanstack/react-query": "^4.29.0",
    "chart.js": "^4.3.0",
    "cron": "^2.3.0",
    "date-fns": "^2.29.3",
    "ioredis": "^5.3.2",
    "mixpanel": "^0.18.0",
    "next": "14.0.0",
    "next-auth": "^4.22.1",
    "node-fetch": "^3.3.1",
    "pdf-lib": "^1.17.1",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "recharts": "^2.5.0",
    "stripe": "^12.1.1",
    "xlsx": "^0.18.5",
    "zod": "^3.21.4"
  },
  "devDependencies": {
    "@types/cron": "^2.0.1",
    "@types/node": "18.15.11",
    "@types/react": "18.0.34",
    "@types/react-dom": "18.0.11",
    "autoprefixer": "10.4.14",
    "eslint": "8.38.0",
    "eslint-config-next": "14.0.0",
    "eslint-config-prettier": "^8.8.0",
    "postcss": "8.4.21",
    "prisma": "^4.12.0",
    "tailwindcss": "3.3.1",
    "typescript": "5.0.4"
  }
}
EOL

# Skip package-lock.json - it will be regenerated
rm -f /workspaces/billing-management-platform/package-lock.json

# Mark conflicts as resolved
git add .env prisma/schema.prisma package.json

# Commit the merge
git commit -m "Resolve merge conflicts with remote repository"

echo "Conflicts resolved! Now pushing to remote..."

# Push to remote
git push origin main

echo "Process complete!"
