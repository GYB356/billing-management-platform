import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { z } from 'zod';

// Error categories for better organization
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Error schema for structured logging
const ErrorSchema = z.object({
  category: z.nativeEnum(ErrorCategory),
  severity: z.nativeEnum(ErrorSeverity),
  message: z.string(),
  code: z.string().optional(),
  stack: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

export class ErrorService {
  /**
   * Log an error with structured data
   */
  static async logError(error: z.infer<typeof ErrorSchema>): Promise<void> {
    try {
      // Validate error data
      const validatedError = ErrorSchema.parse(error);

      // Store error in database
      await prisma.errorLog.create({
        data: {
          ...validatedError,
          metadata: validatedError.metadata || {},
        },
      });

      // Create event for monitoring
      await createEvent({
        eventType: 'ERROR_OCCURRED',
        resourceType: 'ERROR',
        severity: this.mapErrorSeverityToEventSeverity(validatedError.severity),
        metadata: {
          category: validatedError.category,
          message: validatedError.message,
          code: validatedError.code,
          stack: validatedError.stack,
        },
        userId: validatedError.userId,
        organizationId: validatedError.organizationId,
      });

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error:', {
          ...validatedError,
          timestamp: validatedError.timestamp.toISOString(),
        });
      }
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  /**
   * Handle API errors
   */
  static async handleApiError(error: unknown, context: {
    userId?: string;
    organizationId?: string;
    endpoint?: string;
    method?: string;
  }): Promise<{ status: number; message: string }> {
    try {
      // Determine error category and severity
      const { category, severity, message, code } = this.analyzeError(error);

      // Log the error
      await this.logError({
        category,
        severity,
        message,
        code,
        stack: error instanceof Error ? error.stack : undefined,
        metadata: {
          endpoint: context.endpoint,
          method: context.method,
        },
        userId: context.userId,
        organizationId: context.organizationId,
      });

      // Return appropriate response
      return {
        status: this.getHttpStatus(category, severity),
        message: this.getUserFriendlyMessage(category, severity),
      };
    } catch (handlingError) {
      console.error('Failed to handle API error:', handlingError);
      return {
        status: 500,
        message: 'An unexpected error occurred',
      };
    }
  }

  /**
   * Analyze error to determine category and severity
   */
  private static analyzeError(error: unknown): {
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    code?: string;
  } {
    if (error instanceof z.ZodError) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
      };
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.name === 'PrismaClientKnownRequestError') {
        return {
          category: ErrorCategory.DATABASE,
          severity: ErrorSeverity.HIGH,
          message: 'Database error',
          code: 'DATABASE_ERROR',
        };
      }

      if (error.name === 'AuthenticationError') {
        return {
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Authentication error',
          code: 'AUTH_ERROR',
        };
      }

      if (error.name === 'AuthorizationError') {
        return {
          category: ErrorCategory.AUTHORIZATION,
          severity: ErrorSeverity.HIGH,
          message: 'Authorization error',
          code: 'AUTHZ_ERROR',
        };
      }
    }

    // Default error analysis
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'UNKNOWN_ERROR',
    };
  }

  /**
   * Map error severity to event severity
   */
  private static mapErrorSeverityToEventSeverity(severity: ErrorSeverity): EventSeverity {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return EventSeverity.CRITICAL;
      case ErrorSeverity.HIGH:
        return EventSeverity.ERROR;
      case ErrorSeverity.MEDIUM:
        return EventSeverity.WARNING;
      case ErrorSeverity.LOW:
        return EventSeverity.INFO;
    }
  }

  /**
   * Get HTTP status code based on error category and severity
   */
  private static getHttpStatus(category: ErrorCategory, severity: ErrorSeverity): number {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return 401;
      case ErrorCategory.AUTHORIZATION:
        return 403;
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.DATABASE:
        return severity === ErrorSeverity.CRITICAL ? 503 : 500;
      case ErrorCategory.EXTERNAL_SERVICE:
        return 502;
      case ErrorCategory.BUSINESS_LOGIC:
        return 422;
      case ErrorCategory.SYSTEM:
        return severity === ErrorSeverity.CRITICAL ? 503 : 500;
    }
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(category: ErrorCategory, severity: ErrorSeverity): string {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please check your credentials.';
      case ErrorCategory.AUTHORIZATION:
        return 'You do not have permission to perform this action.';
      case ErrorCategory.VALIDATION:
        return 'Invalid input. Please check your request and try again.';
      case ErrorCategory.DATABASE:
        return severity === ErrorSeverity.CRITICAL
          ? 'Service temporarily unavailable. Please try again later.'
          : 'An error occurred while processing your request.';
      case ErrorCategory.EXTERNAL_SERVICE:
        return 'Unable to connect to external service. Please try again later.';
      case ErrorCategory.BUSINESS_LOGIC:
        return 'The requested operation cannot be performed.';
      case ErrorCategory.SYSTEM:
        return severity === ErrorSeverity.CRITICAL
          ? 'System error. Please try again later.'
          : 'An unexpected error occurred.';
    }
  }

  /**
   * Get error statistics
   */
  static async getErrorStatistics(options: {
    startDate?: Date;
    endDate?: Date;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  } = {}): Promise<{
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: Array<{
      id: string;
      category: ErrorCategory;
      severity: ErrorSeverity;
      message: string;
      timestamp: Date;
    }>;
  }> {
    try {
      const where = {
        timestamp: {
          gte: options.startDate,
          lte: options.endDate,
        },
        ...(options.category && { category: options.category }),
        ...(options.severity && { severity: options.severity }),
      };

      const [total, byCategory, bySeverity, recentErrors] = await Promise.all([
        prisma.errorLog.count({ where }),
        prisma.errorLog.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        prisma.errorLog.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
        prisma.errorLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            category: true,
            severity: true,
            message: true,
            timestamp: true,
          },
        }),
      ]);

      return {
        total,
        byCategory: byCategory.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.category]: curr._count,
          }),
          {} as Record<ErrorCategory, number>
        ),
        bySeverity: bySeverity.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.severity]: curr._count,
          }),
          {} as Record<ErrorSeverity, number>
        ),
        recentErrors,
      };
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      throw error;
    }
  }
} 