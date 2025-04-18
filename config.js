/**
 * Configuration management for the application
 * Handles loading and validating environment variables
 */

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  try {
    // Try to load dotenv if installed
    require('dotenv').config();
  } catch (error) {
    console.warn('dotenv not installed, skipping .env file loading');
  }
}

// Required environment variables - application will exit if any are missing
const requiredEnvVars = process.env.NODE_ENV === 'production' 
  ? ['NODE_ENV'] 
  : [];

// Check for required environment variables in production
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Configuration object with defaults
const config = {
  // Server settings
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Rate limiting settings
  rateLimiter: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute default
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10), // 60 requests per minute default
  },
  
  // Authentication rate limiting settings
  authRateLimiter: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
    maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10), // 5 requests per 15 minutes default
  },
  
  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    optionsSuccessStatus: 200,
  },
  
  // Security settings
  security: {
    sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret'),
    jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-jwt-secret'),
  },
  
  // Database settings (if applicable)
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-app',
  },
  
  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Warn if using default secrets in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) {
    console.warn('Warning: Using default session secret in production. This is a security risk.');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('Warning: Using default JWT secret in production. This is a security risk.');
  }
}

module.exports = config; 