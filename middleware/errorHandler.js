/**
 * Global Error Handler Middleware
 * Provides consistent error response format across the application
 */

const config = require('../config');
const logger = require('../utils/logger');

// Custom error class for API errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;
  
  // Log the error
  const logMeta = {
    statusCode: error.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.user?.id || 'anonymous',
    requestId: req.id,
    stack: config.env === 'development' ? error.stack : undefined
  };
  
  // Different types of errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = new AppError(messages.join(', '), 400);
    logger.warn(`Validation Error: ${error.message}`, logMeta);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(`Duplicate field value: ${field}`, 400);
    logger.warn(`Duplicate Key Error: ${error.message}`, logMeta);
  } else if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
    logger.warn(`Cast Error: ${error.message}`, logMeta);
  } else if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
    logger.warn(`JWT Error: ${error.message}`, logMeta);
  } else if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
    logger.warn(`JWT Error: ${error.message}`, logMeta);
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large', 400);
    logger.warn(`File Upload Error: ${error.message}`, logMeta);
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Unexpected file', 400);
    logger.warn(`File Upload Error: ${error.message}`, logMeta);
  } else if (error.statusCode === 404) {
    logger.warn(`Not Found: ${error.message}`, logMeta);
  } else if (error.statusCode >= 400 && error.statusCode < 500) {
    // Client errors
    logger.warn(`Client Error: ${error.message}`, logMeta);
  } else {
    // Server errors or uncaught exceptions
    logger.error(`Server Error: ${error.message}`, logMeta);
  }
  
  // Generate response
  const response = {
    success: false,
    error: error.message || 'Server Error',
    errorCode: err.code || 'UNKNOWN_ERROR'
  };
  
  // Include stack trace in development environment
  if (config.env === 'development') {
    response.stack = error.stack;
  }
  
  return res.status(error.statusCode || 500).json(response);
};

module.exports = {
  errorHandler,
  AppError
}; 