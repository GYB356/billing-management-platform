import * as winston from 'winston';
import { join } from 'path';

const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

export class Logger {
  private static logger = winston.createLogger({
    levels: logLevels,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: 'billing-platform' },
    transports: [
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });
  
  // Add file transports in production
  static {
    if (process.env.NODE_ENV === 'production') {
      // Ensure logs directory exists
      const logsDir = join(process.cwd(), 'logs');
      
      // Add error log file
      this.logger.add(new winston.transports.File({
        filename: join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }));
      
      // Add combined log file
      this.logger.add(new winston.transports.File({
        filename: join(logsDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }));
      
      // Add special transport for financial transactions
      this.logger.add(new winston.transports.File({
        filename: join(logsDir, 'financial-transactions.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      }));
    }
  }
  
  static trace(message: string, meta?: any): void {
    this.logger.log('trace', message, meta);
  }
  
  static debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
  
  static info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }
  
  static warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }
  
  static error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }
  
  static fatal(message: string, meta?: any): void {
    this.logger.log('fatal', message, meta);
  }
  
  static logFinancialTransaction(transactionData: any): void {
    this.logger.info('Financial transaction', {
      type: 'financial_transaction',
      timestamp: new Date().toISOString(),
      data: this.sanitizeFinancialData(transactionData)
    });
  }
  
  private static sanitizeFinancialData(data: any): any {
    const sanitized = { ...data };
    
    // Remove sensitive data
    if (sanitized.cardNumber) {
      sanitized.cardNumber = `****${sanitized.cardNumber.slice(-4)}`;
    }
    if (sanitized.cvv) {
      sanitized.cvv = '***';
    }
    
    return sanitized;
  }
} 