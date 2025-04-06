import { prisma } from '@/lib/prisma';
import { AggregationType, MeteringType } from '@prisma/client';
import { createEvent } from '../events';

interface AggregationConfig {
  type: MeteringType;
  method: AggregationType;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dimensions?: string[];
}

export class UsageAggregator {
  private static instance: UsageAggregator;
  private aggregationJobs: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.aggregationJobs = new Map();
  }

  public static getInstance(): UsageAggregator {
    if (!UsageAggregator.instance) {
      UsageAggregator.instance = new UsageAggregator();
    }
    return UsageAggregator.instance;
  }

  public async startAggregation(metricId: string, config: AggregationConfig): Promise<void> {
    if (this.aggregationJobs.has(metricId)) {
      throw new Error(`Aggregation already running for metric ${metricId}`);
    }

    const interval = this.getIntervalMs(config.interval);
    const job = setInterval(() => this.aggregate(metricId, config), interval);
    this.aggregationJobs.set(metricId, job);

    // Run initial aggregation
    await this.aggregate(metricId, config);
  }

  public stopAggregation(metricId: string): void {
    const job = this.aggregationJobs.get(metricId);
    if (job) {
      clearInterval(job);
      this.aggregationJobs.delete(metricId);
    }
  }

  private async aggregate(metricId: string, config: AggregationConfig): Promise<void> {
    const timeRange = this.getTimeRange(config.interval);

    try {
      // Get raw usage records
      const records = await prisma.usageRecord.findMany({
        where: {
          featureId: metricId,
          timestamp: {
            gte: timeRange.start,
            lt: timeRange.end
          }
        },
        include: {
          subscription: true
        }
      });

      // Group by dimensions if specified
      const groupedRecords = this.groupRecords(records, config.dimensions);

      // Calculate aggregates for each group
      for (const [groupKey, groupRecords] of Object.entries(groupedRecords)) {
        const value = this.calculateAggregate(groupRecords.map(r => r.quantity), config.method);
        
        // Store aggregated result
        await prisma.aggregatedUsage.create({
          data: {
            metricId,
            period: timeRange.start.toISOString(),
            value,
            groupKey,
            metadata: {
              interval: config.interval,
              method: config.method,
              recordCount: groupRecords.length
            }
          }
        });
      }

      // Create event for monitoring
      await createEvent({
        type: 'USAGE_AGGREGATED',
        resourceType: 'USAGE_METRIC',
        resourceId: metricId,
        metadata: {
          interval: config.interval,
          timeRange,
          recordCount: records.length,
          groupCount: Object.keys(groupedRecords).length
        }
      });

    } catch (error) {
      console.error(`Error aggregating usage for metric ${metricId}:`, error);
      await createEvent({
        type: 'USAGE_AGGREGATION_ERROR',
        resourceType: 'USAGE_METRIC',
        resourceId: metricId,
        severity: 'ERROR',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          interval: config.interval,
          timeRange
        }
      });
    }
  }

  private getTimeRange(interval: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end = now;

    switch (interval) {
      case 'hourly':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        break;
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const day = now.getDay();
        start = new Date(now.setDate(now.getDate() - day));
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        throw new Error(`Invalid interval: ${interval}`);
    }

    return { start, end };
  }

  private getIntervalMs(interval: string): number {
    const intervals: Record<string, number> = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };

    return intervals[interval] || intervals.hourly;
  }

  private groupRecords(records: any[], dimensions?: string[]): Record<string, any[]> {
    if (!dimensions || !dimensions.length) {
      return { 'default': records };
    }

    return records.reduce((groups, record) => {
      const key = dimensions
        .map(dim => {
          const value = dim.split('.').reduce((obj, key) => obj?.[key], record);
          return value?.toString() || 'unknown';
        })
        .join(':');

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private calculateAggregate(values: number[], method: AggregationType): number {
    switch (method) {
      case 'SUM':
        return values.reduce((sum, val) => sum + val, 0);
      case 'AVG':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      case 'LAST':
        return values[values.length - 1] || 0;
      default:
        throw new Error(`Unsupported aggregation method: ${method}`);
    }
  }

  public async dispose(): Promise<void> {
    for (const [metricId, job] of this.aggregationJobs.entries()) {
      clearInterval(job);
      this.aggregationJobs.delete(metricId);
    }
  }
}