import fs from 'fs/promises';
import path from 'path';
import { LogLevel, LoggerConfig, LogEntry, PerformanceLogEntry } from '../types/logging';

export class Logger {
  private config: LoggerConfig;
  private operationTimers: Map<string, Date>;

  constructor(config: LoggerConfig) {
    this.config = {
      ...config,
      logLevel: config.logLevel || LogLevel.INFO,
      enableFileLogging: config.enableFileLogging || false,
      metadata: config.metadata || {}
    };
    this.operationTimers = new Map();
  }

  public setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
  }

  public async debug(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  public async info(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, metadata);
  }

  public async warn(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, metadata);
  }

  public async error(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, metadata);
  }

  public startOperation(operationName: string): void {
    this.operationTimers.set(operationName, new Date());
  }

  public endOperation(operationName: string): number {
    const startTime = this.operationTimers.get(operationName);
    if (!startTime) {
      throw new Error(`No timer found for operation: ${operationName}`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const perfLog: PerformanceLogEntry = {
      timestamp: endTime,
      level: LogLevel.INFO,
      message: `Operation ${operationName} completed`,
      appName: this.config.appName,
      operationName,
      duration,
      startTime,
      endTime
    };

    this.logToConsole(perfLog);
    if (this.config.enableFileLogging) {
      this.writeToFile(JSON.stringify(perfLog)).catch(error => {
        console.error('Failed to write performance log to file:', error);
      });
    }

    this.operationTimers.delete(operationName);
    return duration;
  }

  private async log(level: LogLevel, message: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata: { ...this.config.metadata, ...metadata },
      appName: this.config.appName
    };

    this.logToConsole(logEntry);

    if (this.config.enableFileLogging) {
      await this.writeToFile(JSON.stringify(logEntry)).catch(error => {
        console.error('Failed to write to log file:', error);
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const configLevelIndex = levels.indexOf(this.config.logLevel as LogLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= configLevelIndex;
  }

  private logToConsole(entry: LogEntry | PerformanceLogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    console.log(`[${timestamp}] ${entry.level.toUpperCase()} [${entry.appName}] ${entry.message}${metadata}`);
  }

  private async writeToFile(content: string): Promise<void> {
    if (!this.config.logFilePath) {
      throw new Error('Log file path not configured');
    }

    const logDir = path.dirname(this.config.logFilePath);
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(this.config.logFilePath, content + '\n');
  }
} 