import { PrismaClient } from '@prisma/client';
import { Logger } from './logger';

export class TransactionManager {
  private static prisma = new PrismaClient();
  
  /**
   * Execute operations within a transaction
   * @param operations Function containing database operations
   * @returns Result of operations
   */
  static async executeInTransaction<T>(
    operations: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Execute operations in transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        return operations(prisma);
      });
      
      // Log successful transaction
      Logger.debug('Transaction completed successfully', {
        duration: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      // Log failed transaction
      Logger.error('Transaction failed', {
        error,
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }
  
  /**
   * Execute operations within a transaction with a timeout
   * @param operations Function containing database operations
   * @param timeoutMs Transaction timeout in milliseconds
   * @returns Result of operations
   */
  static async executeInTransactionWithTimeout<T>(
    operations: (prisma: PrismaClient) => Promise<T>,
    timeoutMs: number = 5000
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Execute operations in transaction with timeout
      const result = await this.prisma.$transaction(
        async (prisma) => {
          return operations(prisma);
        },
        {
          timeout: timeoutMs,
          maxWait: timeoutMs,
        }
      );
      
      // Log successful transaction
      Logger.debug('Transaction completed successfully', {
        duration: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      // Log failed transaction
      Logger.error('Transaction failed', {
        error,
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }
  
  /**
   * Execute operations within a transaction with retries
   * @param operations Function containing database operations
   * @param maxRetries Maximum number of retry attempts
   * @param baseDelayMs Base delay between retries in milliseconds
   * @returns Result of operations
   */
  static async executeWithRetry<T>(
    operations: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 100
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeInTransaction(operations);
      } catch (error) {
        lastError = error;
        
        // Log retry attempt
        Logger.warn('Transaction failed, attempting retry', {
          attempt,
          maxRetries,
          error,
        });
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * baseDelayMs,
          5000 // Max delay of 5 seconds
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never happen due to the throw in the loop
    throw lastError || new Error('Transaction failed after retries');
  }
  
  /**
   * Clean up resources
   */
  static async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
} 