#!/bin/bash

# Exit on error
set -e

# Load production environment variables
set -a
source .env.production
set +a

# Check required environment variables
required_vars=(
  "DATABASE_URL"
  "NEXTAUTH_URL"
  "NEXTAUTH_SECRET"
  "REDIS_URL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: $var is not set"
    exit 1
  fi
done

# Start the application
echo "🚀 Starting production server..."

# Run database healthcheck
echo "🏥 Running database healthcheck..."
npx prisma db push --skip-generate

# Start the Next.js production server
NODE_ENV=production \
PORT=${PORT:-3000} \
npm run start 