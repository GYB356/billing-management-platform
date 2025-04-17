import { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { logSecurityEvent, SecurityEventType, SecurityEventSeverity } from '../security/logging';
import { captureException, init as initSentry } from '@sentry/nextjs';
import { Span, SpanStatus } from '@sentry/types';
import { performance } from 'perf_hooks';

// Initialize Sentry
initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Prisma.Integrations.Prisma({ client: prisma }),
  ],
});

interface ResourceLimits {
  maxCpuPercentage?: number;
  maxMemoryMB?: number;
  maxIoOps?: number;
}

interface MonitoringOptions {
  name: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  resourceLimits?: ResourceLimits;
  enableGracefulDegradation?: boolean;
}

interface PerformanceMetrics {
  duration: number;
  memory: NodeJS.MemoryUsage;
  timestamp: number;
  cpuUsage?: number;
  ioOperations?: number;
}

export class Monitoring {
  private static instance: Monitoring;
  private metricsBuffer: PerformanceMetrics[] = [];
  private readonly flushInterval = 60000; // 1 minute
  private resourceUsage = {
    cpu: new Array<number>(),
    memory: new Array<number>(),
    io: new Array<number>(),
  };

  private constructor() {
    setInterval(() => this.flushMetrics(), this.flushInterval);
  }

  static getInstance(): Monitoring {
    if (!Monitoring.instance) {
      Monitoring.instance = new Monitoring();
    }
    return Monitoring.instance;
  }

  private async measureCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    return (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
  }

  private async checkResourceLimits(
    options: MonitoringOptions,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const limits = options.resourceLimits;
    if (!limits) return;

    const violations: string[] = [];

    if (limits.maxCpuPercentage && metrics.cpuUsage && metrics.cpuUsage > limits.maxCpuPercentage) {
      violations.push('CPU_LIMIT_EXCEEDED');
    }

    if (limits.maxMemoryMB && metrics.memory.heapUsed > limits.maxMemoryMB * 1024 * 1024) {
      violations.push('MEMORY_LIMIT_EXCEEDED');
    }

    if (limits.maxIoOps && metrics.ioOperations && metrics.ioOperations > limits.maxIoOps) {
      violations.push('IO_LIMIT_EXCEEDED');
    }

    if (violations.length > 0) {
      await logSecurityEvent({
        type: SecurityEventType.RESOURCE_VIOLATION,
        severity: SecurityEventSeverity.HIGH,
        metadata: {
          violations,
          operationName: options.name,
          userId: options.userId,
          ...options.metadata,
        },
      });

      throw new Error('Resource limits exceeded');
    }
  }

  private async handleGracefulDegradation(options: MonitoringOptions): Promise<void> {
    if (!options.enableGracefulDegradation) return;

    const cpuUsage = await this.measureCpuUsage();
    const memoryUsage = process.memoryUsage();

    if (cpuUsage > 80 || memoryUsage.heapUsed > 0.8 * memoryUsage.heapTotal) {
      console.info('Graceful degradation activated', {
        reducedCpuUsage: cpuUsage * 0.8,
        throttledOperations: true,
      });

      // Implement throttling
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async trackPerformance<T>(
    operation: () => Promise<T>,
    options: MonitoringOptions
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    let result: T;

    try {
      // Monitor CPU usage
      const cpuUsagePromise = this.measureCpuUsage();

      // Monitor I/O operations
      let ioOperations = 0;
      const originalSetTimeout = setTimeout;
      (global as any).setTimeout = (fn: Function, ms: number) => {
        ioOperations++;
        return originalSetTimeout(fn, ms);
      };

      // Execute operation
      result = await operation();

      // Restore setTimeout
      (global as any).setTimeout = originalSetTimeout;

      const endTime = performance.now();
      const duration = endTime - startTime;
      const memory = process.memoryUsage();
      const cpuUsage = await cpuUsagePromise;

      const metrics: PerformanceMetrics = {
        duration,
        memory,
        timestamp: Date.now(),
        cpuUsage,
        ioOperations,
      };

      // Update resource usage tracking
      this.resourceUsage.cpu.push(cpuUsage);
      this.resourceUsage.memory.push(memory.heapUsed);
      this.resourceUsage.io.push(ioOperations);

      // Keep only last 100 measurements
      Object.values(this.resourceUsage).forEach(arr => {
        if (arr.length > 100) arr.shift();
      });

      // Check resource limits
      await this.checkResourceLimits(options, metrics);

      // Handle graceful degradation
      await this.handleGracefulDegradation(options);

      this.metricsBuffer.push(metrics);

      // Log warnings for high resource usage
      if (cpuUsage > 80) {
        console.warn('High CPU usage detected', {
          name: options.name,
          cpuUsage,
        });
      }

      if (memory.heapUsed > 0.9 * memory.heapTotal) {
        console.error('Memory limit exceeded', {
          name: options.name,
          memoryUsage: memory.heapUsed,
          memoryLimit: memory.heapTotal,
        });
      }

      if (ioOperations > 1000) {
        console.warn('I/O bottleneck detected', {
          name: options.name,
          latency: duration / ioOperations,
        });
      }

      if (duration > 1000) {
        console.warn('Slow operation detected:', {
          name: options.name,
          duration,
        });
      }

      return result;
    } catch (error) {
      captureException(error, {
        extra: {
          name: options.name,
          userId: options.userId,
          metadata: options.metadata,
        },
      });
      throw error;
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const averageDuration =
      this.metricsBuffer.reduce((sum, m) => sum + m.duration, 0) /
      this.metricsBuffer.length;

    const maxMemory = Math.max(
      ...this.metricsBuffer.map(m => m.memory.heapUsed)
    );

    const averageCpuUsage =
      this.resourceUsage.cpu.reduce((sum, usage) => sum + usage, 0) /
      this.resourceUsage.cpu.length;

    const peakCpuUsage = Math.max(...this.resourceUsage.cpu);

    const memoryGrowthRate =
      (this.resourceUsage.memory[this.resourceUsage.memory.length - 1] -
        this.resourceUsage.memory[0]) /
      this.resourceUsage.memory.length;

    await logSecurityEvent({
      type: SecurityEventType.RESOURCE_METRICS,
      severity:
        peakCpuUsage > 80 || memoryGrowthRate > 1024 * 1024 * 10 // 10MB/sample
          ? SecurityEventSeverity.HIGH
          : SecurityEventSeverity.LOW,
      metadata: {
        averageDuration,
        maxMemory,
        sampleSize: this.metricsBuffer.length,
        timestamp: new Date().toISOString(),
        averageCpuUsage,
        peakCpuUsage,
        memoryGrowthRate,
        averageIoOps:
          this.resourceUsage.io.reduce((sum, ops) => sum + ops, 0) /
          this.resourceUsage.io.length,
      },
    });

    this.metricsBuffer = [];
  }
}

// Middleware for API route monitoring
export function withMonitoring(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const monitoring = Monitoring.getInstance();
    const options: MonitoringOptions = {
      name: `${req.method} ${req.url}`,
      userId: (req as any).user?.id,
      metadata: {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        query: req.query,
      },
    };

    return monitoring.trackPerformance(() => handler(req, res), options);
  };
}

export { Monitoring, type MonitoringOptions, type ResourceLimits }; 