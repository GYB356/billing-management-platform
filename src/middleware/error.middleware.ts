import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

interface AppError extends Error {
  statusCode: number;
  isOperational?: boolean;
}

interface ValidationError extends Error {
  errors: Record<string, string[]>;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction // Prefix with _ to indicate intentionally unused
) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errorDetails = !isProduction ? { detail: error.message, stack: error.stack } : {};

  // Log all errors with request context
  console.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'],
    userId: (req as any).user?.id, // Type assertion for user property
  });

  // Handle AppError instances (custom application errors)
  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: error.message,
      isOperational: error.isOperational,
      ...errorDetails,
    });
  }

  // Handle Prisma database errors
  if (error instanceof PrismaClientKnownRequestError) {
    return res.status(400).json({
      error: 'Database operation failed',
      code: error.code,
      ...errorDetails,
    });
  }

  // Handle JWT authentication errors
  if (error instanceof JsonWebTokenError) {
    return res.status(401).json({
      error: 'Invalid authentication token',
      ...errorDetails,
    });
  }

  if (error instanceof TokenExpiredError) {
    return res.status(401).json({
      error: 'Authentication token expired',
      ...errorDetails,
    });
  }

  // Handle validation errors
  if (isValidationError(error)) {
    return res.status(400).json({
      error: 'Validation failed',
      validationErrors: error.errors,
      ...errorDetails,
    });
  }

  // Handle all other unexpected errors
  return res.status(500).json({
    error: 'Internal server error',
    ...errorDetails,
  });
};

// Type guard functions
function isAppError(error: Error): error is AppError {
  return 'statusCode' in error;
}

function isValidationError(error: Error): error is ValidationError {
  return 'errors' in error && Array.isArray((error as ValidationError).errors);
} 