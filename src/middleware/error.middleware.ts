import { Request, Response, NextFunction } from 'express';
import { AppError, PaymentError } from '../utils/errors';
import { Logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log all errors
  Logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'],
    userId: req.user?.id
  });
  
  // Handle AppError instances
  if (error instanceof AppError) {
    // Special handling for payment errors
    if (error instanceof PaymentError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.isOperational ? error.gatewayResponse : undefined
      });
    }
    
    return res.status(error.statusCode).json({
      error: error.message,
      ...(error['errors'] && { validationErrors: error['errors'] })
    });
  }
  
  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: 'Database operation failed',
      code: 'DATABASE_ERROR',
      ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
    });
  }
  
  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // Handle validation errors from express-validator
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      validationErrors: error['errors']
    });
  }
  
  // Unexpected errors
  console.error('Unexpected error:', error);
  
  return res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    // Don't expose internal error details in production
    ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
  });
}; 