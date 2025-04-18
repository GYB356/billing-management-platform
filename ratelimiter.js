const rateLimit = require('express-rate-limit');
const config = require('./config');

const authLimiter = rateLimit({
  windowMs: config.authRateLimiter.windowMs, // Default: 15 minutes
  max: config.authRateLimiter.maxRequests, // Default: 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: config.rateLimiter.windowMs, // Default: 1 minute
  max: config.rateLimiter.maxRequests, // Default: 60 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter }; 