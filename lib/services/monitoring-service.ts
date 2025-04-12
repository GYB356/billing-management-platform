import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { z } from 'zod';
import type { PerformanceMetrics, SystemMetrics } from '@/types/monitoring';

/**
 * Interface for database operations used by MonitoringService
 */
interface DatabaseOperations {
  createMetrics(data: SystemMetrics): Promise<void>;
  getMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]>;
}

/**
 * Interface for event operations used by MonitoringService
 */
interface EventOperations {
  createEvent(event: {
    eventType: string;
    resourceType: string;
    severity: EventSeverity;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Default implementation of DatabaseOperations using Prisma
 */
class PrismaDbOperations implements DatabaseOperations {
  async createMetrics(data: SystemMetrics): Promise<void> {
    await prisma.systemMetrics.create({
      data: {
        timestamp: data.timestamp,
        cpu: data.cpu,
        memory: data.memory,
        disk: data.disk,
        network: data.network,
      },
    });
  }

  async getMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    const metrics = await prisma.systemMetrics.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return metrics.map(m => this.mapToPerformanceMetrics(m));
  }

  private mapToPerformanceMetrics(data: any): PerformanceMetrics {
    return {
      timestamp: data.timestamp,
      cpu: data.cpu,
      memory: data.memory,
      requests: {
        total: data.requests?.total ?? 0,
        success: data.requests?.success ?? 0,
        failed: data.requests?.failed ?? 0,
        averageLatency: data.requests?.averageLatency ?? 0,
      },
      database: {
        queries: data.database?.queries ?? 0,
        slowQueries: data.database?.slowQueries ?? 0,
        averageLatency: data.database?.averageLatency ?? 0,
        errors: data.database?.errors ?? 0,
      },
      cache: {
        hits: data.cache?.hits ?? 0,
        misses: data.cache?.misses ?? 0,
        hitRate: data.cache?.hitRate ?? 0,
        size: data.cache?.size ?? 0,
      },
      externalServices: data.externalServices ?? {},
    };
  }
}

/**
 * Default implementation of EventOperations
 */
class DefaultEventOperations implements EventOperations {
  async createEvent(event: {
    eventType: string;
    resourceType: string;
    severity: EventSeverity;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await createEvent(event);
  }
}

/**
 * MonitoringService class responsible for system monitoring and metrics collection
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private lastMetrics: SystemMetrics | null = null;

  private constructor(
    private readonly db: DatabaseOperations,
    private readonly eventOps: EventOperations
  ) {}

  /**
   * Get singleton instance of MonitoringService
   */
  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService(
        new PrismaDbOperations(),
        new DefaultEventOperations()
      );
    }
    return MonitoringService.instance;
  }

  /**
   * Start monitoring system metrics
   */
  public async startMonitoring(): Promise<void> {
    try {
      this.metricsInterval = setInterval(
        () => this.collectSystemMetrics(),
        60000 // 1 minute
      );

      await this.runHealthChecks();
      await this.eventOps.createEvent({
        eventType: 'MONITORING_STARTED',
        resourceType: 'SYSTEM',
        severity: EventSeverity.INFO,
      });
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      await this.eventOps.createEvent({
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
   * Stop monitoring system metrics
   */
  public async stopMonitoring(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    await this.eventOps.createEvent({
      eventType: 'MONITORING_STOPPED',
      resourceType: 'SYSTEM',
      severity: EventSeverity.INFO,
    });
  }

  /**
   * Get performance metrics for a given time range
   */
  public async getPerformanceMetrics(options: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<PerformanceMetrics> {
    const metrics = await this.db.getMetrics(
      options.startDate ?? new Date(Date.now() - 3600000),
      options.endDate ?? new Date()
    );
    return metrics[0] ?? this.getDefaultMetrics();
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      this.lastMetrics = metrics;
      await this.db.createMetrics(metrics);
      await this.checkMetricsAlerts(metrics);
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
      await this.eventOps.createEvent({
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
   * Get current system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    // Implementation would use system-specific APIs
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
   * Get default metrics when no data is available
   */
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      cpu: { usage: 0, cores: 0, load: [] },
      memory: { total: 0, used: 0, free: 0 },
      requests: { total: 0, success: 0, failed: 0, averageLatency: 0 },
      database: { queries: 0, slowQueries: 0, averageLatency: 0, errors: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0, size: 0 },
      externalServices: {},
    };
  }

  /**
   * Check metrics for alerts
   */
  private async checkMetricsAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts = this.getMetricAlerts(metrics);
    
    for (const alert of alerts) {
      await this.eventOps.createEvent({
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
   * Get alerts based on current metrics
   */
  private getMetricAlerts(metrics: SystemMetrics): Array<{
      type: string;
      message: string;
      severity: EventSeverity;
  }> {
    const alerts = [];

    // CPU Usage Alert
    if (metrics.cpu.usage > 0.8) {
      alerts.push({
        type: 'HIGH_CPU_USAGE',
        message: `CPU usage is at ${(metrics.cpu.usage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    // Memory Usage Alert
    const memoryUsage = metrics.memory.used / metrics.memory.total;
    if (memoryUsage > 0.9) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `Memory usage is at ${(memoryUsage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    // Disk Usage Alert
    if (metrics.disk.usage > 0.85) {
      alerts.push({
        type: 'HIGH_DISK_USAGE',
        message: `Disk usage is at ${(metrics.disk.usage * 100).toFixed(1)}%`,
        severity: EventSeverity.WARNING,
      });
    }

    return alerts;
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
      await this.eventOps.createEvent({
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

      if (duration > 5000) {
        await this.eventOps.createEvent({
          eventType: 'DATABASE_SLOW_RESPONSE',
          resourceType: 'DATABASE',
          severity: EventSeverity.WARNING,
          metadata: {
            duration,
          },
        });
      }
    } catch (error) {
      await this.eventOps.createEvent({
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

      if (duration > 3000) {
        await this.eventOps.createEvent({
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
      await this.eventOps.createEvent({
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
      await this.eventOps.createEvent({
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
      await this.eventOps.createEvent({
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
      await this.eventOps.createEvent({
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
} 