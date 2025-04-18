const mongoose = require('mongoose');
const { JsonWebTokenError, TokenExpiredError } = require('jsonwebtoken');

/**
 * Global error handling system for consistent error responses
 */

// Custom error class with status code and isOperational flag
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indicates this is a known, operational error

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle known errors in development environment
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Handle known errors in production environment
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong'
    });
  }
};

// Handle mongoose validation errors
const handleValidationError = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle mongoose duplicate key errors
const handleDuplicateFieldsError = err => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

// Handle mongoose CastError (invalid ID)
const handleCastError = err => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () => 
  new AppError('Invalid token. Please log in again.', 401);

// Handle JWT expired error
const handleJWTExpiredError = () => 
  new AppError('Your token has expired. Please log in again.', 401);

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    
    if (err instanceof mongoose.Error.CastError) error = handleCastError(err);
    if (err instanceof mongoose.Error.ValidationError) error = handleValidationError(err);
    if (err.code === 11000) error = handleDuplicateFieldsError(err);
    if (err instanceof JsonWebTokenError) error = handleJWTError();
    if (err instanceof TokenExpiredError) error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Utility function to wrap async route handlers for error handling
const asyncHandler = fn => (req, res, next) => {
  fn(req, res, next).catch(next);
};

// Export everything
module.exports = {
  AppError,
  errorHandler,
  asyncHandler
}; 