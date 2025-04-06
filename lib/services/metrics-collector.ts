import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { createEvent } from '../events';

export interface CustomMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p95?: number;
  p99?: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private emitter: EventEmitter;
  private buffer: Map<string, CustomMetric[]>;
  private flushInterval: NodeJS.Timeout | null;
  private readonly maxBufferSize = 1000;
  private readonly flushIntervalMs = 60000; // 1 minute

  private constructor() {
    this.emitter = new EventEmitter();
    this.buffer = new Map();
    this.startBufferFlush();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public track(metric: CustomMetric): void {
    const key = this.getMetricKey(metric);
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    
    const metrics = this.buffer.get(key)!;
    metrics.push({
      ...metric,
      timestamp: metric.timestamp || new Date()
    });

    if (metrics.length >= this.maxBufferSize) {
      this.flush(key);
    }

    this.emitter.emit('metric', metric);
  }

  public async getMetrics(
    metricName: string,
    startTime: Date,
    endTime: Date,
    tags?: Record<string, string>
  ): Promise<AggregatedMetrics> {
    const metrics = await prisma.customMetric.findMany({
      where: {
        name: metricName,
        timestamp: {
          gte: startTime,
          lte: endTime
        },
        ...(tags && { tags: { equals: tags } })
      }
    });

    if (!metrics.length) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0
      };
    }

    const values = metrics.map(m => m.value);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  public onMetric(callback: (metric: CustomMetric) => void): void {
    this.emitter.on('metric', callback);
  }

  public removeListener(callback: (metric: CustomMetric) => void): void {
    this.emitter.off('metric', callback);
  }

  private getMetricKey(metric: CustomMetric): string {
    const tagString = metric.tags 
      ? Object.entries(metric.tags)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`)
          .join(',')
      : '';
    return `${metric.name}${tagString ? `:${tagString}` : ''}`;
  }

  private async flush(key?: string): Promise<void> {
    const keys = key ? [key] : Array.from(this.buffer.keys());
    
    for (const k of keys) {
      const metrics = this.buffer.get(k) || [];
      if (!metrics.length) continue;

      try {
        await prisma.$transaction(
          metrics.map(metric => 
            prisma.customMetric.create({
              data: {
                name: metric.name,
                value: metric.value,
                unit: metric.unit,
                tags: metric.tags || {},
                timestamp: metric.timestamp!
              }
            })
          )
        );

        // Create aggregated event for monitoring
        await createEvent({
          type: 'METRICS_FLUSHED',
          resourceType: 'METRICS',
          metadata: {
            metricName: metrics[0].name,
            count: metrics.length,
            timeRange: {
              start: metrics[0].timestamp,
              end: metrics[metrics.length - 1].timestamp
            }
          }
        });

        this.buffer.set(k, []);
      } catch (error) {
        console.error(`Error flushing metrics for key ${k}:`, error);
      }
    }
  }

  private startBufferFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  public async dispose(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    this.emitter.removeAllListeners();
  }
}