const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');

// Import error handlers and utilities
const { errorHandler, AppError } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');

// Import route handlers
const invoiceRoutes = require('./routes/invoice');

// Initialize express app
const app = express();

// Load security middleware with proper error handling
const loadSecurityMiddleware = () => {
  const middleware = {};
  
  try {
    middleware.helmet = require('helmet');
    middleware.mongoSanitize = require('express-mongo-sanitize');
    middleware.xss = require('xss-clean');
    middleware.hpp = require('hpp');
    middleware.cors = require('cors');
    middleware.rateLimiter = require('./ratelimiter');
    middleware.security = require('./security');
    
    logger.info('All security middleware loaded successfully');
    return middleware;
  } catch (error) {
    logger.error('Failed to load security middleware', { error: error.message });
    throw new Error('Critical security packages missing. Run: npm install helmet cors xss-clean express-mongo-sanitize hpp');
  }
};

// Load middleware or exit if critical packages are missing
let middleware;
try {
  middleware = loadSecurityMiddleware();
} catch (error) {
  logger.error(error.message);
  process.exit(1);
}

const { helmet, mongoSanitize, xss, hpp, cors, rateLimiter, security } = middleware;
const { authLimiter, apiLimiter } = rateLimiter;
const { sanitizeInput, sanitizeMongoQuery } = security;

// Add request ID to each request for better tracing - BEFORE logging
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Apply request logging middleware AFTER request ID is set
app.use(logger.logRequest);

// Apply security middleware
app.use(helmet()); // Set security HTTP headers
app.use(cors(config.cors));
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Sanitize user input
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Apply middleware
app.use(express.json({
  limit: config.requestSizeLimits.json || '10kb' // Use config value or fallback
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: config.requestSizeLimits.urlencoded || '10kb'
}));

// Health check endpoint for Docker and monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Apply rate limiter to all API routes except health check
app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  return apiLimiter(req, res, next);
});

// Apply stricter rate limiter to authentication endpoints
app.use('/api/auth', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/reset-password', authLimiter);

// Register route handlers
app.use('/api/invoices', invoiceRoutes);

// Input validation middleware with config values
const validateLoginInput = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return next(new AppError('Missing required fields: username, password', 400));
  }
  
  // Validate username format (alphanumeric, no special chars except underscore)
  if (!config.validation.usernameRegex.test(username)) {
    return next(new AppError('Invalid username format: must be alphanumeric and may include underscores', 400));
  }
  
  // Ensure password meets minimum requirements
  if (password.length < config.validation.minPasswordLength) {
    return next(new AppError(`Password must be at least ${config.validation.minPasswordLength} characters`, 400));
  }
  
  // Sanitize inputs
  req.body.username = sanitizeInput(username);
  
  next();
};

// Example authentication route with input validation
app.post('/api/auth/login', validateLoginInput, asyncHandler(async (req, res) => {
  // Your login logic here
  res.json({
    success: true,
    message: 'Login successful',
    user: { username: req.body.username },
    token: 'mock-jwt-token' // In a real app, this would be a JWT
  });
}));

// Example API route with sanitization
app.get('/api/data', asyncHandler(async (req, res) => {
  // Sanitize query parameters
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, config.pagination.maxLimit || 100);
  
  // Safely parse and sanitize filter
  let query = {};
  if (req.query.filter) {
    try {
      query = sanitizeMongoQuery(JSON.parse(req.query.filter));
    } catch (err) {
      return next(new AppError('Invalid filter format', 400));
    }
  }
  
  // Your API logic here
  res.json({
    success: true,
    page,
    limit,
    data: 'API endpoint'
  });
}));

// 404 handler - Routes not found
app.use((req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
});

// Global error handler - must be placed after all other middleware and routes
app.use(errorHandler);

// Graceful shutdown helper
const gracefulShutdown = (signal) => {
  return () => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close any database connections here
      // db.disconnect().then(() => {
      //   logger.info('Database connections closed');
      //   process.exit(0);
      // });
      
      // If no async operations need to complete:
      process.exit(0);
    });
    
    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
};

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.env} mode on port ${PORT}`);
});

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown('SIGTERM'));
process.on('SIGINT', gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION!', { error: err.message, stack: err.stack });
  // Continue running - let the specific operation fail, not the whole server
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION!', { error: err.message, stack: err.stack });
  // For uncaught exceptions we should exit as the app state might be corrupted
  gracefulShutdown('UNCAUGHT EXCEPTION')();
});

module.exports = app;