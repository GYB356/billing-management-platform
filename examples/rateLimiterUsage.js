/**
 * Example demonstrating how to use rate limiters in different routes
 */
const express = require('express');
const router = express.Router();
const {
  authLimiter,
  apiLimiter,
  heavyOperationsLimiter,
  createUserRateLimiter
} = require('../middleware/rateLimiter');

// Apply API rate limiting to all routes by default
router.use(apiLimiter);

// Authentication routes with stricter limits
router.post('/auth/login', authLimiter, (req, res) => {
  // Login logic
});

router.post('/auth/register', authLimiter, (req, res) => {
  // Registration logic
});

// Resource-intensive operations
router.get('/reports/generate', heavyOperationsLimiter, (req, res) => {
  // Generate report
});

// User-specific rate limiting
const userActionLimiter = createUserRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20 // 20 requests per 10 minutes
});

router.post('/users/send-message', userActionLimiter, (req, res) => {
  // Send message logic
});

// Combining rate limiters
router.post('/api/custom-operation', 
  [apiLimiter, heavyOperationsLimiter], 
  (req, res) => {
    // Custom operation logic
  }
);

module.exports = router; 