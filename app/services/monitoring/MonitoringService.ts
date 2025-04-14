import { prisma } from '@/lib/prisma';
import { Metric, Alert } from '@prisma/client';

export class MonitoringService {
  /**
   * Record a metric in the database
   */
  async recordMetric(
    name: string,
    value: number,
    tags?: Record<string, any>
  ): Promise<Metric> {
    return prisma.metric.create({
      data: {
        name,
        value,
        tags: tags || {},
      },
    });
  }

  /**
   * Get metrics for a given name and optional time range
   */
  async getMetrics(
    name: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<Metric[]> {
    return prisma.metric.findMany({
      where: {
        name,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  /**
   * Create a new alert
   */
  async createAlert(
    type: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): Promise<Alert> {
    return prisma.alert.create({
      data: {
        type,
        message,
        severity,
        metadata: metadata || {},
        resolved: false,
      },
    });
  }

  /**
   * Get alerts with optional filters
   */
  async getAlerts(
    type?: string,
    severity?: string,
    resolved?: boolean,
    startTime?: Date,
    endTime?: Date
  ): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: {
        type,
        severity,
        resolved,
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string): Promise<Alert> {
    return prisma.alert.update({
      where: { id },
      data: { resolved: true },
    });
  }

  /**
   * Get metric statistics for a given time range
   */
  async getMetricStats(
    name: string,
    startTime: Date,
    endTime: Date
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    count: number;
  }> {
    const metrics = await this.getMetrics(name, startTime, endTime);
    const values = metrics.map((m) => m.value);

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  /**
   * Check if a metric exceeds a threshold over a duration
   */
  async checkMetricThreshold(
    name: string,
    threshold: number,
    comparison: 'gt' | 'lt' | 'eq',
    duration: number
  ): Promise<boolean> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - duration * 1000);

    const metrics = await this.getMetrics(name, startTime, endTime);
    if (metrics.length === 0) return false;

    const latestValue = metrics[0].value;

    switch (comparison) {
      case 'gt':
        return latestValue > threshold;
      case 'lt':
        return latestValue < threshold;
      case 'eq':
        return latestValue === threshold;
      default:
        return false;
    }
  }
} 