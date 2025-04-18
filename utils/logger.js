const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log levels with custom colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define color scheme for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Configure console format with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`;
  }),
  winston.format.colorize({ all: true })
);

// Define transports
const transports = [
  // Console transport for all logs in development
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
  
  // Rotate file for errors
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
  }),
  
  // Rotate file for all logs
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Function to log HTTP requests
logger.logRequest = (req, res, next) => {
  const start = Date.now();
  
  // Log when the request completes
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(logLevel, `HTTP ${req.method} ${req.originalUrl}`, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      ...(req.user && { userId: req.user._id })
    });
  });
  
  next();
};

// Function to log API errors
logger.logError = (err, req, res, next) => {
  logger.error(`API Error: ${err.message}`, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode: err.statusCode || 500,
    stack: err.stack,
    ...(req.user && { userId: req.user._id }),
    payload: req.body
  });
  
  next(err);
};

// Function to log database operations (for debugging)
logger.logDBOperation = (operation, collection, query, result) => {
  if (process.env.LOG_DB_OPERATIONS === 'true') {
    logger.debug(`DB ${operation} on ${collection}`, {
      operation,
      collection,
      query: JSON.stringify(query),
      result: typeof result === 'object' ? 'Result object received' : result
    });
  }
};

// Function to log application events
logger.logAppEvent = (event, data = {}) => {
  logger.info(`AppEvent: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Function to log security events
logger.logSecurity = (event, data = {}) => {
  logger.warn(`Security: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Stream for Morgan HTTP logger integration
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;