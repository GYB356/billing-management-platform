import winston from 'winston';
import * as Sentry from '@sentry/node';
import { Integrations } from '@sentry/tracing';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [new Integrations.Prisma()],
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'billing-platform' },
  transports: [
    // Write all logs to file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: parseInt(process.env.LOG_FILE_MAX_SIZE || '10485760'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
    }),
  ],
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Error tracking middleware
export const errorTracker = (error: Error, req: any, res: any, next: any) => {
  Sentry.captureException(error);
  logger.error(error.message, {
    error,
    path: req.path,
    method: req.method,
    body: req.body,
  });
  next(error);
};

export { logger, Sentry }; 