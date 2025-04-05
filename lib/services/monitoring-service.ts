import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { z } from 'zod';

// System health check configuration
const HEALTH_CHECK_CONFIG = {
  databaseTimeout: 5000, // 5 seconds
  externalServiceTimeout: 3000, // 3 seconds
  memoryThreshold: 0.9, // 90% memory usage
  cpuThreshold: 0.8, // 80% CPU usage
  diskThreshold: 0.85, // 85% disk usage
};

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  slowQueryThreshold: 1000, // 1 second
  highErrorRateThreshold: 0.05, // 5%
  highLatencyThreshold: 500, // 500ms
  metricsInterval: 60000, // 1 minute
};

// System metrics schema
const SystemMetricsSchema = z.object({
  timestamp: z.date(),
  cpu: z.object({
    usage: z.number(),
    cores: z.number(),
    load: z.array(z.number()),
  }),
  memory: z.object({
    total: z.number(),
    used: z.number(),
    free: z.number(),
    swap: z.object({
      total: z.number(),
      used: z.number(),
      free: z.number(),
    }),
  }),
  disk: z.object({
    total: z.number(),
    used: z.number(),
    free: z.number(),
    usage: z.number(),
  }),
  network: z.object({
    bytesIn: z.number(),
    bytesOut: z.number(),
    connections: z.number(),
  }),
});

// Performance metrics schema
const PerformanceMetricsSchema = z.object({
  timestamp: z.date(),
  requests: z.object({
    total: z.number(),
    success: z.number(),
    failed: z.number(),
    averageLatency: z.number(),
  }),
  database: z.object({
    queries: z.number(),
    slowQueries: z.number(),
    averageLatency: z.number(),
    errors: z.number(),
  }),
  cache: z.object({
    hits: z.number(),
    misses: z.number(),
    hitRate: z.number(),
    size: z.number(),
  }),
  externalServices: z.record(z.object({
    requests: z.number(),
    errors: z.number(),
    averageLatency: z.number(),
  })),
});

export class MonitoringService {
  private static instance: MonitoringService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private lastMetrics: z.infer<typeof SystemMetricsSchema> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<void> {
    try {
      // Start system metrics collection
      this.metricsInterval = setInterval(
        () => this.collectSystemMetrics(),
        PERFORMANCE_CONFIG.metricsInterval
      );

      // Start health checks
      await this.runHealthChecks();

      // Log monitoring start
      await createEvent({
        eventType: 'MONITORING_STARTED',
        resourceType: 'SYSTEM',
        severity: EventSeverity.INFO,
      });
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      await createEvent({
        eventType: 'MONITORING_START_ERROR',
        resourceType: 'SYSTEM',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    await createEvent({
      eventType: 'MONITORING_STOPPED',
      resourceType: 'SYSTEM',
      severity: EventSeverity.INFO,
    });
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      this.lastMetrics = metrics;

      // Store metrics in database
      await prisma.systemMetrics.create({
        data: {
          timestamp: metrics.timestamp,
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          network: metrics.network,
        },
      });

      // Check for alerts
      await this.checkMetricsAlerts(metrics);
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
      await createEvent({
        eventType: 'METRICS_COLLECTION_ERROR',
        resourceType: 'SYSTEM',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<z.infer<typeof SystemMetricsSchema>> {
    // In a real implementation, this would use system-specific APIs
    // For now, we'll return mock data
    return {
      timestamp: new Date(),
      cpu: {
        usage: 0.5,
        cores: 4,
        load: [0.5, 0.6, 0.4],
      },
      memory: {
        total: 8589934592, // 8GB
        used: 4294967296, // 4GB
        free: 4294967296, // 4GB
        swap: {
          total: 4294967296, // 4GB
          used: 0,
          free: 4294967296, // 4GB
        },
      },
      disk: {
        total: 107374182400, // 100GB
        used: 53687091200, // 50GB
        free: 53687091200, // 50GB
        usage: 0.5,
      },
      network: {
        bytesIn: 1024 * 1024, // 1MB
        bytesOut: 512 * 1024, // 512KB
        connections: 100,
      },
    };
  }

  /**
   * Check metrics for alerts
   */
  private async checkMetricsAlerts(metrics: z.infer<typeof SystemMetricsSchema>): Promise<void> {
    const alerts: Array<{
      type: string;
      message: string;
      severity: EventSeverity;
    }> = [];

    // Check CPU usage
    if (metrics.cpu.usage > HEALTH_CHECK_CONFIG.cpuThreshold) {
      alerts.push({
        type: 'HIGH_CPU_USAGE',
        message: `CPU usage is at ${(metrics.cpu.usage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    // Check memory usage
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    if (memoryUsage > HEALTH_CHECK_CONFIG.memoryThreshold) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `Memory usage is at ${(memoryUsage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    // Check disk usage
    if (metrics.disk.usage > HEALTH_CHECK_CONFIG.diskThreshold) {
      alerts.push({
        type: 'HIGH_DISK_USAGE',
        message: `Disk usage is at ${(metrics.disk.usage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    // Create alerts
    for (const alert of alerts) {
      await createEvent({
        eventType: alert.type,
        resourceType: 'SYSTEM',
        severity: alert.severity,
        metadata: {
          message: alert.message,
        },
      });
    }
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(): Promise<void> {
    try {
      // Check database connection
      await this.checkDatabaseHealth();

      // Check external services
      await this.checkExternalServices();

      // Check system resources
      await this.checkSystemResources();
    } catch (error) {
      console.error('Health check failed:', error);
      await createEvent({
        eventType: 'HEALTH_CHECK_FAILED',
        resourceType: 'SYSTEM',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      if (duration > HEALTH_CHECK_CONFIG.databaseTimeout) {
        await createEvent({
          eventType: 'DATABASE_SLOW_RESPONSE',
          resourceType: 'DATABASE',
          severity: EventSeverity.WARNING,
          metadata: {
            duration,
          },
        });
      }
    } catch (error) {
      await createEvent({
        eventType: 'DATABASE_HEALTH_CHECK_FAILED',
        resourceType: 'DATABASE',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Check external services health
   */
  private async checkExternalServices(): Promise<void> {
    // In a real implementation, this would check various external services
    // For now, we'll just check Stripe as an example
    try {
      const start = Date.now();
      await fetch('https://api.stripe.com/v1/health');
      const duration = Date.now() - start;

      if (duration > HEALTH_CHECK_CONFIG.externalServiceTimeout) {
        await createEvent({
          eventType: 'EXTERNAL_SERVICE_SLOW_RESPONSE',
          resourceType: 'EXTERNAL_SERVICE',
          severity: EventSeverity.WARNING,
          metadata: {
            service: 'stripe',
            duration,
          },
        });
      }
    } catch (error) {
      await createEvent({
        eventType: 'EXTERNAL_SERVICE_HEALTH_CHECK_FAILED',
        resourceType: 'EXTERNAL_SERVICE',
        severity: EventSeverity.ERROR,
        metadata: {
          service: 'stripe',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(): Promise<void> {
    if (!this.lastMetrics) return;

    const { cpu, memory, disk } = this.lastMetrics;

    // Check CPU load
    const averageLoad = cpu.load.reduce((a, b) => a + b, 0) / cpu.load.length;
    if (averageLoad > cpu.cores * 0.8) {
      await createEvent({
        eventType: 'HIGH_SYSTEM_LOAD',
        resourceType: 'SYSTEM',
        severity: EventSeverity.WARNING,
        metadata: {
          averageLoad,
          cores: cpu.cores,
        },
      });
    }

    // Check memory pressure
    const memoryPressure = memory.used / memory.total;
    if (memoryPressure > 0.9) {
      await createEvent({
        eventType: 'HIGH_MEMORY_PRESSURE',
        resourceType: 'SYSTEM',
        severity: EventSeverity.WARNING,
        metadata: {
          pressure: memoryPressure,
        },
      });
    }

    // Check swap usage
    const swapUsage = memory.swap.used / memory.swap.total;
    if (swapUsage > 0.5) {
      await createEvent({
        eventType: 'HIGH_SWAP_USAGE',
        resourceType: 'SYSTEM',
        severity: EventSeverity.WARNING,
        metadata: {
          usage: swapUsage,
        },
      });
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      timestamp: Date;
    }>;
  }> {
    try {
      const checks = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkExternalServices(),
        this.checkSystemResources(),
      ]);

      const status = checks.some(check => check.status === 'unhealthy')
        ? 'unhealthy'
        : checks.some(check => check.status === 'degraded')
        ? 'degraded'
        : 'healthy';

      return {
        status,
        checks,
      };
    } catch (error) {
      console.error('Failed to get system health:', error);
      return {
        status: 'unhealthy',
        checks: [],
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(options: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<z.infer<typeof PerformanceMetricsSchema>> {
    try {
      const where = {
        timestamp: {
          gte: options.startDate,
          lte: options.endDate,
        },
      };

      const [
        requests,
        database,
        cache,
        externalServices,
      ] = await Promise.all([
        prisma.event.aggregate({
          where: {
            ...where,
            eventType: 'API_REQUEST',
          },
          _count: true,
          _avg: {
            metadata: {
              path: 'duration',
            },
          },
        }),
        prisma.event.aggregate({
          where: {
            ...where,
            eventType: 'DATABASE_QUERY',
          },
          _count: true,
          _avg: {
            metadata: {
              path: 'duration',
            },
          },
        }),
        prisma.event.aggregate({
          where: {
            ...where,
            eventType: 'CACHE_ACCESS',
          },
          _count: true,
        }),
        prisma.event.groupBy({
          by: ['metadata.service'],
          where: {
            ...where,
            eventType: 'EXTERNAL_SERVICE_REQUEST',
          },
          _count: true,
          _avg: {
            metadata: {
              path: 'duration',
            },
          },
        }),
      ]);

      return {
        timestamp: new Date(),
        requests: {
          total: requests._count,
          success: requests._count - (requests._count * 0.05), // Assuming 5% error rate
          failed: requests._count * 0.05,
          averageLatency: requests._avg.metadata?.duration || 0,
        },
        database: {
          queries: database._count,
          slowQueries: database._count * 0.01, // Assuming 1% slow queries
          averageLatency: database._avg.metadata?.duration || 0,
          errors: database._count * 0.01, // Assuming 1% error rate
        },
        cache: {
          hits: cache._count * 0.8, // Assuming 80% hit rate
          misses: cache._count * 0.2,
          hitRate: 0.8,
          size: 1024 * 1024, // 1MB cache size
        },
        externalServices: externalServices.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.metadata.service as string]: {
              requests: curr._count,
              errors: curr._count * 0.05, // Assuming 5% error rate
              averageLatency: curr._avg.metadata?.duration || 0,
            },
          }),
          {}
        ),
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw error;
    }
  }
} 