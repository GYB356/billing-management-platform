const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const { redisConfig } = require('../config/database');

// Create Redis client
let redisClient;
try {
  redisClient = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    username: redisConfig.username,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });
} catch (error) {
  console.error('Redis connection failed:', error);
}

// Auth rate limiter - protects login, registration, and password reset endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  // Use Redis store if available, otherwise use memory store
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:auth:',
    // Using a more unique identifier that combines IP and endpoint
    keyGenerator: (req) => `${req.ip}:${req.originalUrl}`,
  }) : undefined,
});

// API rate limiter - general protection for all API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests. Please try again after a minute.'
  },
  // Use Redis store if available, otherwise use memory store
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:api:',
    keyGenerator: (req) => `${req.ip}:${req.path}`,
  }) : undefined,
});

// Heavy operations rate limiter - for resource-intensive endpoints
const heavyOperationsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests for this resource-intensive operation. Please try again after 5 minutes.'
  },
  // Use Redis store if available, otherwise use memory store
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rl:heavy:',
    keyGenerator: (req) => `${req.ip}:${req.path}`,
  }) : undefined,
});

// User-specific rate limiter function creator
// This can be used for endpoints where you need per-user rate limiting
const createUserRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // Default: 1 minute
    max: options.max || 30, // Default: 30 requests per window per user
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: options.message || 'Rate limit exceeded. Please try again later.'
    },
    // Use a key generator that includes the user ID
    keyGenerator: (req) => {
      const userId = req.user?.id || 'anonymous';
      return `${userId}:${req.path}`;
    },
    // Use Redis store if available, otherwise use memory store
    store: redisClient ? new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:user:',
    }) : undefined,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
  });
};

module.exports = {
  authLimiter,
  apiLimiter,
  heavyOperationsLimiter,
  createUserRateLimiter,
  redisClient, // Export Redis client for potential reuse
}; 