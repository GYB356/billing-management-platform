# Multi-stage build for a more secure and optimized Node.js application

# Stage 1: Build stage
FROM node:18-slim AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Use npm ci for clean installs in CI/CD environments
RUN npm ci --only=production

# Copy application code
COPY . .

# If there's a build step (for TypeScript or other transpiled languages)
# RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine
WORKDIR /app

# Create app directory with proper permissions
RUN mkdir -p /app && chown -R node:node /app

# Set NODE_ENV
ENV NODE_ENV=production

# Copy only necessary files from the builder stage
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/*.js ./
COPY --from=builder --chown=node:node /app/security.js ./
COPY --from=builder --chown=node:node /app/ratelimiter.js ./

# If you have a build output directory, copy it instead
# COPY --from=builder --chown=node:node /app/dist ./dist

# Expose the port
EXPOSE 3000

# Use non-root user for security
USER node

# Use an array of commands for better signal handling
CMD ["node", "app.js"] 