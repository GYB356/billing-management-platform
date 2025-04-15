export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LoggerConfig {
  appName: string;
  logLevel: LogLevel | string;
  enableFileLogging?: boolean;
  logFilePath?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  appName: string;
}

export interface PerformanceLogEntry extends LogEntry {
  operationName: string;
  duration: number;
  startTime: Date;
  endTime: Date;
} 