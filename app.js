const express = require('express');
const { authLimiter, apiLimiter } = require('./ratelimiter');
const { sanitizeInput, sanitizeMongoQuery } = require('./security');
const config = require('./config');

// Import route handlers
const invoiceRoutes = require('./routes/invoice');

// Import error handlers and utilities
const { errorHandler, AppError } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const logger = require('./utils/logger');

// Load required middleware depending on environment
let helmet, mongoSanitize, xss, hpp, cors;
try {
  // These imports will fail if packages aren't installed
  helmet = require('helmet');
  mongoSanitize = require('express-mongo-sanitize');
  xss = require('xss-clean');
  hpp = require('hpp');
  cors = require('cors');
} catch (error) {
  console.warn('Some security middleware packages are not installed. Run: npm install helmet cors xss-clean express-mongo-sanitize hpp');
}

const app = express();

// Add request ID to each request for better tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Apply request logging middleware
app.use(logger.logRequest);

// Apply security middleware if available
if (helmet) app.use(helmet()); // Set security HTTP headers
if (cors) app.use(cors(config.cors));
if (mongoSanitize) app.use(mongoSanitize()); // Prevent NoSQL injection
if (xss) app.use(xss()); // Sanitize user input
if (hpp) app.use(hpp()); // Prevent HTTP Parameter Pollution

// Apply middleware
app.use(express.json({
  limit: '10kb' // Limit JSON body size to prevent DoS attacks
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10kb' // Limit URL-encoded body size
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

// Input validation middleware
const validateLoginInput = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return next(new AppError('Missing required fields: username, password', 400));
  }
  
  // Validate username format (alphanumeric, no special chars except underscore)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return next(new AppError('Invalid username format: must be alphanumeric and may include underscores', 400));
  }
  
  // Ensure password meets minimum requirements
  if (password.length < 8) {
    return next(new AppError('Password must be at least 8 characters', 400));
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
  const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Cap at 100
  
  // Sanitize any MongoDB queries that might be used
  const query = sanitizeMongoQuery(req.query.filter ? JSON.parse(req.query.filter) : {});
  
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

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { error: err.message, stack: err.stack });
  // Close server and exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', { error: err.message, stack: err.stack });
  // Exit process
  process.exit(1);
});

module.exports = app; 