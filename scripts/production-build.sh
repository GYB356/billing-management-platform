#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting production build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Type checking
echo "🔍 Running type checks..."
npm run type-check

# Linting
echo "🧹 Running linter..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm run test

# Build application
echo "🏗️ Building application..."
npm run build

# Database migrations
echo "🗄️ Running database migrations..."
npm run migrate

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate

echo "✅ Production build completed successfully!" 