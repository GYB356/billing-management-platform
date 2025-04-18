# Multi-stage build for a more secure and optimized Node.js application

###########
# BUILDER #
###########

# Use Node Alpine for the build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (if needed, uncomment)
# RUN npm run build

# Remove development dependencies
RUN npm prune --production

##########
# RUNNER #
##########

# Use Node Alpine for the final image
FROM node:18-alpine AS runner

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodeuser

# Set working directory
WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./
COPY --from=builder --chown=nodeuser:nodejs /app/models ./models
COPY --from=builder --chown=nodeuser:nodejs /app/middleware ./middleware
COPY --from=builder --chown=nodeuser:nodejs /app/routes ./routes
COPY --from=builder --chown=nodeuser:nodejs /app/utils ./utils
COPY --from=builder --chown=nodeuser:nodejs /app/controllers ./controllers
COPY --from=builder --chown=nodeuser:nodejs /app/server.js ./

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:$PORT/api/health || exit 1

# Switch to the non-root user
USER nodeuser

# Expose the port
EXPOSE $PORT

# Start the application
CMD ["node", "server.js"] 