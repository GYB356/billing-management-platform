import winston from 'winston';
import * as Sentry from '@sentry/nextjs';

// Custom format that includes timestamp and request ID
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'next-app' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Write all errors to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Sentry error handler
const sentryTransport = {
  log(info: any, callback: () => void) {
    if (info.level === 'error') {
      Sentry.captureException(info.error || info.message);
    }
    callback();
  }
};

// Add Sentry as a transport if SENTRY_DSN is configured
if (process.env.SENTRY_DSN) {
  logger.add(sentryTransport);
}

// Export a wrapper function to add request context
export const createRequestLogger = (req: any) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  
  return {
    info: (message: string, meta = {}) => {
      logger.info(message, { requestId, ...meta });
    },
    error: (message: string, error?: Error, meta = {}) => {
      logger.error(message, { 
        requestId,
        error: error?.stack || error,
        ...meta 
      });
    },
    warn: (message: string, meta = {}) => {
      logger.warn(message, { requestId, ...meta });
    },
    debug: (message: string, meta = {}) => {
      logger.debug(message, { requestId, ...meta });
    }
  };
};

export default logger; 