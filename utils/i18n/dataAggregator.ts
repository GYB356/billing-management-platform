import { WarmingMetrics } from './warmingMetrics';
import { formatBytes, formatTime } from '@/utils/format';

interface AggregatedMetrics {
  timestamp: number;
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    totalTranslations: number;
    successfulWarms: number;
    failedWarms: number;
    cacheHits: number;
    cacheMisses: number;
    averageLoadTime: number;
    totalSize: number;
    memoryUsage: number;
    successRate: number;
    cacheHitRate: number;
    retryRate: number;
  };
}

interface AggregationConfig {
  maxStorageSize: number;
  retentionPeriod: {
    hour: number;
    day: number;
    week: number;
    month: number;
  };
  compressionEnabled: boolean;
}

export class DataAggregator {
  private static instance: DataAggregator;
  private config: AggregationConfig;
  private storage: Map<string, AggregatedMetrics[]>;
  private isAggregating: boolean = false;

  private constructor() {
    this.config = {
      maxStorageSize: 100 * 1024 * 1024, // 100MB
      retentionPeriod: {
        hour: 24, // 24 hours
        day: 30,  // 30 days
        week: 12, // 12 weeks
        month: 12 // 12 months
      },
      compressionEnabled: true
    };
    this.storage = new Map();
    this.initializeStorage();
  }

  static getInstance(): DataAggregator {
    if (!DataAggregator.instance) {
      DataAggregator.instance = new DataAggregator();
    }
    return DataAggregator.instance;
  }

  private initializeStorage(): void {
    ['hour', 'day', 'week', 'month'].forEach(period => {
      this.storage.set(period, []);
    });
  }

  setConfig(config: Partial<AggregationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async aggregateMetrics(metrics: WarmingMetrics[], period: 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    if (this.isAggregating) return;
    this.isAggregating = true;

    try {
      const aggregated = this.calculateAggregatedMetrics(metrics, period);
      await this.storeAggregatedMetrics(aggregated, period);
      await this.cleanupOldData(period);
      await this.optimizeStorage();
    } finally {
      this.isAggregating = false;
    }
  }

  private calculateAggregatedMetrics(metrics: WarmingMetrics[], period: 'hour' | 'day' | 'week' | 'month'): AggregatedMetrics {
    const now = Date.now();
    const aggregated: AggregatedMetrics = {
      timestamp: now,
      period,
      metrics: {
        totalTranslations: 0,
        successfulWarms: 0,
        failedWarms: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageLoadTime: 0,
        totalSize: 0,
        memoryUsage: 0,
        successRate: 0,
        cacheHitRate: 0,
        retryRate: 0
      }
    };

    // Calculate totals
    metrics.forEach(metric => {
      aggregated.metrics.totalTranslations += metric.totalTranslations;
      aggregated.metrics.successfulWarms += metric.successfulWarms;
      aggregated.metrics.failedWarms += metric.failedWarms;
      aggregated.metrics.cacheHits += metric.cacheHits;
      aggregated.metrics.cacheMisses += metric.cacheMisses;
      aggregated.metrics.totalSize += metric.totalSize;
      aggregated.metrics.memoryUsage += metric.memoryUsage;
    });

    // Calculate averages and rates
    const count = metrics.length;
    aggregated.metrics.averageLoadTime = metrics.reduce((sum, m) => sum + m.averageLoadTime, 0) / count;
    aggregated.metrics.successRate = aggregated.metrics.successfulWarms / aggregated.metrics.totalTranslations;
    aggregated.metrics.cacheHitRate = aggregated.metrics.cacheHits / (aggregated.metrics.cacheHits + aggregated.metrics.cacheMisses);
    aggregated.metrics.retryRate = metrics.reduce((sum, m) => sum + m.retryCount, 0) / count;

    return aggregated;
  }

  private async storeAggregatedMetrics(metrics: AggregatedMetrics, period: 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    const storage = this.storage.get(period) || [];
    storage.push(metrics);
    
    // Sort by timestamp
    storage.sort((a, b) => a.timestamp - b.timestamp);
    
    // Update storage
    this.storage.set(period, storage);
    
    // Save to persistent storage
    await this.saveToStorage(period);
  }

  private async cleanupOldData(period: 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    const storage = this.storage.get(period) || [];
    const retention = this.config.retentionPeriod[period];
    const now = Date.now();
    
    // Remove data older than retention period
    const filtered = storage.filter(metric => {
      const age = now - metric.timestamp;
      const maxAge = retention * this.getPeriodMilliseconds(period);
      return age <= maxAge;
    });
    
    this.storage.set(period, filtered);
    await this.saveToStorage(period);
  }

  private getPeriodMilliseconds(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  private async optimizeStorage(): Promise<void> {
    const totalSize = await this.calculateStorageSize();
    
    if (totalSize > this.config.maxStorageSize) {
      // Remove oldest data from each period
      for (const period of ['hour', 'day', 'week', 'month'] as const) {
        const storage = this.storage.get(period) || [];
        const retention = this.config.retentionPeriod[period];
        
        // Keep only the most recent data within retention period
        const filtered = storage.slice(-retention);
        this.storage.set(period, filtered);
      }
      
      await this.saveToStorage();
    }
  }

  private async calculateStorageSize(): Promise<number> {
    let totalSize = 0;
    
    for (const storage of this.storage.values()) {
      totalSize += JSON.stringify(storage).length;
    }
    
    return totalSize;
  }

  private async saveToStorage(period?: 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    const data = period ? 
      { [period]: this.storage.get(period) } : 
      Object.fromEntries(this.storage);
    
    const serialized = this.config.compressionEnabled ? 
      await this.compressData(JSON.stringify(data)) : 
      JSON.stringify(data);
    
    localStorage.setItem('i18n_aggregated_metrics', serialized);
  }

  private async compressData(data: string): Promise<string> {
    // Implement compression logic here
    // This is a placeholder for actual compression implementation
    return data;
  }

  async loadFromStorage(): Promise<void> {
    const serialized = localStorage.getItem('i18n_aggregated_metrics');
    if (!serialized) return;

    const data = this.config.compressionEnabled ? 
      await this.decompressData(serialized) : 
      serialized;

    const parsed = JSON.parse(data);
    this.storage = new Map(Object.entries(parsed));
  }

  private async decompressData(data: string): Promise<string> {
    // Implement decompression logic here
    // This is a placeholder for actual decompression implementation
    return data;
  }

  getAggregatedMetrics(period: 'hour' | 'day' | 'week' | 'month'): AggregatedMetrics[] {
    return this.storage.get(period) || [];
  }

  getMetricsSummary(): {
    totalSize: string;
    metricsCount: number;
    oldestData: Date;
    newestData: Date;
  } {
    let totalSize = 0;
    let metricsCount = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const storage of this.storage.values()) {
      storage.forEach(metric => {
        totalSize += JSON.stringify(metric).length;
        metricsCount++;
        oldestTimestamp = Math.min(oldestTimestamp, metric.timestamp);
        newestTimestamp = Math.max(newestTimestamp, metric.timestamp);
      });
    }

    return {
      totalSize: formatBytes(totalSize),
      metricsCount,
      oldestData: new Date(oldestTimestamp),
      newestData: new Date(newestTimestamp)
    };
  }
}

export const dataAggregator = DataAggregator.getInstance(); 