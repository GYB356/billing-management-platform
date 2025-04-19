/**
 * Configuration management for the application
 * Handles loading and validating environment variables
 */

// Load environment variables from .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  try {
    // Try to load dotenv if installed
    require('dotenv').config();
  } catch (error) {
    console.warn('dotenv not installed, skipping .env file loading');
  }
}

// Define all required environment variables by environment
const ENV_REQUIREMENTS = {
  production: ['NODE_ENV', 'JWT_SECRET', 'SESSION_SECRET'],
  staging: ['NODE_ENV'],
  development: [],
  test: []
};

// Get current environment with a fallback to development
const currentEnv = process.env.NODE_ENV || 'development';

// Check for required environment variables
const requiredEnvVars = ENV_REQUIREMENTS[currentEnv] || [];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables for ${currentEnv} environment: ${missingVars.join(', ')}`);
}

// Validation functions for config values
const validators = {
  isPositiveInteger: (value, name) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${name} must be a positive integer, got: ${value}`);
    }
    return num;
  },
  
  isValidLogLevel: (value) => {
    const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    if (!validLevels.includes(value)) {
      console.warn(`Warning: Invalid log level '${value}'. Using 'info' instead.`);
      return 'info';
    }
    return value;
  },
  
  isValidUrl: (value, name) => {
    try {
      // Simple validation - for more complex validation use a URL parsing library
      if (value !== '*' && !value.startsWith('http')) {
        throw new Error(`${name} must be a valid URL or '*', got: ${value}`);
      }
      return value;
    } catch (err) {
      console.warn(`Warning: Invalid URL for ${name}. Using default instead.`);
      return '*';
    }
  }
};

// Configuration object with defaults
const config = {
  // Server settings
  env: currentEnv,
  port: validators.isPositiveInteger(process.env.PORT || '3000', 'PORT'),
  
  // Request size limits (moved from app.js)
  requestSizeLimits: {
    json: process.env.REQUEST_LIMIT_JSON || '10kb',
    urlencoded: process.env.REQUEST_LIMIT_URLENCODED || '10kb'
  },
  
  // Rate limiting settings
  rateLimiter: {
    windowMs: validators.isPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS || '60000', 'RATE_LIMIT_WINDOW_MS'), // 1 minute default
    maxRequests: validators.isPositiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 'RATE_LIMIT_MAX_REQUESTS'), // 60 requests per minute default
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later'
  },
  
  // Authentication rate limiting settings
  authRateLimiter: {
    windowMs: validators.isPositiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 'AUTH_RATE_LIMIT_WINDOW_MS'), // 15 minutes default
    maxRequests: validators.isPositiveInteger(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 'AUTH_RATE_LIMIT_MAX_REQUESTS'), // 5 requests per 15 minutes default
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later'
  },
  
  // CORS settings
  cors: {
    origin: validators.isValidUrl(process.env.CORS_ORIGIN || (currentEnv === 'production' ? '*' : 'http://localhost:3000'), 'CORS_ORIGIN'),
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  },
  
  // Security settings
  security: {
    sessionSecret: process.env.SESSION_SECRET || (currentEnv === 'production' ? null : 'dev-secret'),
    jwtSecret: process.env.JWT_SECRET || (currentEnv === 'production' ? null : 'dev-jwt-secret'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  
  // Database settings
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-app',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    }
  },
  
  // Logging settings
  logging: {
    level: validators.isValidLogLevel(process.env.LOG_LEVEL || 'info'),
    format: process.env.LOG_FORMAT || (currentEnv === 'production' ? 'json' : 'pretty')
  },
  
  // Validation rules
  validation: {
    usernameRegex: /^[a-zA-Z0-9_]{3,30}$/,
    minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH || '8', 10),
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '10', 10),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100', 10)
  }
};

// Critical security checks for production
if (currentEnv === 'production') {
  // Check for secure secrets
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-secret') {
    console.error('CRITICAL SECURITY ERROR: Using default session secret in production.');
    process.exit(1);
  }
  
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-jwt-secret') {
    console.error('CRITICAL SECURITY ERROR: Using default JWT secret in production.');
    process.exit(1);
  }
}

// Freeze the config object to prevent modifications at runtime
module.exports = Object.freeze(config);