/**
 * Custom Logger Utility
 * Provides consistent logging format across the application
 */

const config = require('../config');

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  HTTP: 3,
  DEBUG: 4
};

// Get the current log level from config or environment variable
const getLogLevel = () => {
  const level = config.logging.level.toUpperCase();
  return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
};

// Format the log message
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    message,
    ...meta,
    environment: config.env
  };
};

// Core logging function
const log = (level, message, meta = {}) => {
  const currentLevel = getLogLevel();
  
  // Only log if the level is less than or equal to the current log level
  if (LOG_LEVELS[level] <= currentLevel) {
    const formattedMessage = formatMessage(level, message, meta);
    
    // In production, we could integrate with a proper logging service here
    // For now, just use console
    if (level === 'ERROR') {
      console.error(JSON.stringify(formattedMessage));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(formattedMessage));
    } else {
      console.log(JSON.stringify(formattedMessage));
    }
  }
};

// Create logger functions for each level
const logger = {
  error: (message, meta = {}) => log('ERROR', message, meta),
  warn: (message, meta = {}) => log('WARN', message, meta),
  info: (message, meta = {}) => log('INFO', message, meta),
  http: (message, meta = {}) => log('HTTP', message, meta),
  debug: (message, meta = {}) => log('DEBUG', message, meta),
  
  // Method to log API requests
  logRequest: (req, res, next) => {
    const startTime = Date.now();
    
    // Log when the response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'WARN' : 'HTTP';
      
      log(logLevel, `${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        duration: `${duration}ms`,
        userId: req.user?.id || 'anonymous'
      });
    });
    
    next();
  }
};

module.exports = logger; 