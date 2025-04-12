import { JWT } from 'next-auth/jwt';

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  attempts: number;
  success: boolean;
}

const metrics = new Map<string, PerformanceMetrics[]>();

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  operationName: string = 'unknown'
): Promise<T> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await operation();
      // Record success metrics
      recordMetrics(operationName, {
        startTime,
        endTime: Date.now(),
        attempts,
        success: true
      });
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Attempt ${attempts}/${maxAttempts} failed for ${operationName}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempts));
      }
    }
  }

  // Record failure metrics
  recordMetrics(operationName, {
    startTime,
    endTime: Date.now(),
    attempts,
    success: false
  });

  throw new Error(
    `Operation ${operationName} failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`
  );
}

function recordMetrics(operationName: string, metrics: PerformanceMetrics): void {
  const existingMetrics = metrics.get(operationName) || [];
  existingMetrics.push(metrics);
  
  // Keep only last 100 metrics per operation
  if (existingMetrics.length > 100) {
    existingMetrics.shift();
  }
  
  metrics.set(operationName, existingMetrics);
}

export function getOperationMetrics(operationName: string) {
  const operationMetrics = metrics.get(operationName) || [];
  const totalOperations = operationMetrics.length;
  
  if (totalOperations === 0) {
    return null;
  }

  const successfulOperations = operationMetrics.filter(m => m.success).length;
  const totalDuration = operationMetrics.reduce((sum, m) => sum + (m.endTime - m.startTime), 0);
  const totalAttempts = operationMetrics.reduce((sum, m) => sum + m.attempts, 0);

  return {
    successRate: (successfulOperations / totalOperations) * 100,
    averageDuration: totalDuration / totalOperations,
    averageAttempts: totalAttempts / totalOperations,
    totalOperations,
    successfulOperations,
    failedOperations: totalOperations - successfulOperations
  };
} 