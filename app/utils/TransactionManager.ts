import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class TransactionManager {
  /**
   * Execute operations within a transaction
   * @param operations Function containing database operations
   * @returns Result of operations
   */
  static async executeInTransaction<T>(
    operations: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    try {
      // Start a transaction
      const result = await prisma.$transaction(async (tx) => {
        return await operations(tx);
      });
      
      return result;
    } catch (error) {
      console.error('Transaction failed', error);
      throw error;
    }
  }
}