import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/lib/errors';
import { Logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errorDetails = !isProduction ? { detail: error.message, stack: error.stack } : {};

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
    return res.status(error.statusCode).json({ error: error.message, ...errorDetails });
  }
  
  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({ error: 'Database error', ...errorDetails });
  }
  
  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Authentication error', ...errorDetails });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', ...errorDetails });
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
  
  return res.status(500).json({ error: 'Internal server error', ...errorDetails });
}; 