const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authValidation } = require('../middleware/validator');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

/**
 * Authentication routes with rate limiting and validation
 */

// Apply auth rate limiter to login endpoint
router.post(
  '/login', 
  authLimiter, 
  authValidation.login, 
  asyncHandler(authController.login)
);

// Registration endpoint with validation
router.post(
  '/register', 
  authValidation.register, 
  asyncHandler(authController.register)
);

// Apply password reset rate limiter to these sensitive endpoints
router.post(
  '/forgot-password', 
  passwordResetLimiter, 
  asyncHandler(authController.forgotPassword)
);

router.patch(
  '/reset-password/:token', 
  passwordResetLimiter, 
  authValidation.resetPassword, 
  asyncHandler(authController.resetPassword)
);

// Protected routes - require authentication
router.use(protect);

router.patch(
  '/update-password', 
  authValidation.updatePassword, 
  asyncHandler(authController.updatePassword)
);

router.get(
  '/me', 
  asyncHandler(authController.getMe)
);

router.patch(
  '/update-me', 
  authValidation.updateMe, 
  asyncHandler(authController.updateMe)
);

router.delete(
  '/delete-me', 
  asyncHandler(authController.deleteMe)
);

router.get(
  '/logout', 
  authController.logout
);

module.exports = router; 