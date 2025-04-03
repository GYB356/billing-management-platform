import { performanceMonitor } from './performanceMonitor';

export interface WarmingMetrics {
  timestamp: number;
  strategyPriority: number;
  languages: string[];
  namespaces: string[];
  totalTranslations: number;
  successfulWarms: number;
  failedWarms: number;
  averageLoadTime: number;
  totalSize: number;
  cacheHits: number;
  cacheMisses: number;
  retryCount: number;
  memoryUsage: number;
}

class WarmingMetricsTracker {
  private static instance: WarmingMetricsTracker;
  private metrics: Map<number, WarmingMetrics> = new Map();
  private readonly maxMetricsPerStrategy = 100;

  private constructor() {}

  static getInstance(): WarmingMetricsTracker {
    if (!WarmingMetricsTracker.instance) {
      WarmingMetricsTracker.instance = new WarmingMetricsTracker();
    }
    return WarmingMetricsTracker.instance;
  }

  trackWarmingStart(strategyPriority: number, languages: string[], namespaces: string[]): void {
    const metrics: WarmingMetrics = {
      timestamp: Date.now(),
      strategyPriority,
      languages,
      namespaces,
      totalTranslations: 0,
      successfulWarms: 0,
      failedWarms: 0,
      averageLoadTime: 0,
      totalSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retryCount: 0,
      memoryUsage: 0
    };

    this.metrics.set(strategyPriority, metrics);
  }

  trackTranslationWarm(
    strategyPriority: number,
    success: boolean,
    loadTime: number,
    size: number,
    cacheHit: boolean,
    retries: number
  ): void {
    const metrics = this.metrics.get(strategyPriority);
    if (!metrics) return;

    metrics.totalTranslations++;
    if (success) {
      metrics.successfulWarms++;
    } else {
      metrics.failedWarms++;
    }

    // Update average load time
    metrics.averageLoadTime = (metrics.averageLoadTime * (metrics.totalTranslations - 1) + loadTime) / metrics.totalTranslations;
    metrics.totalSize += size;
    metrics.cacheHits += cacheHit ? 1 : 0;
    metrics.cacheMisses += cacheHit ? 0 : 1;
    metrics.retryCount += retries;
    metrics.memoryUsage = performance.memory?.usedJSHeapSize || 0;

    // Trim old metrics if needed
    if (this.metrics.size > this.maxMetricsPerStrategy) {
      const oldestKey = Array.from(this.metrics.keys())[0];
      this.metrics.delete(oldestKey);
    }

    // Report metrics to performance monitor
    performanceMonitor.trackTranslationLoad(loadTime, cacheHit, size);
  }

  getMetrics(strategyPriority: number): WarmingMetrics | undefined {
    return this.metrics.get(strategyPriority);
  }

  getAllMetrics(): WarmingMetrics[] {
    return Array.from(this.metrics.values());
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  getStrategyPerformance(strategyPriority: number): {
    successRate: number;
    averageLoadTime: number;
    cacheHitRate: number;
    retryRate: number;
  } {
    const metrics = this.metrics.get(strategyPriority);
    if (!metrics) {
      return {
        successRate: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
        retryRate: 0
      };
    }

    return {
      successRate: metrics.successfulWarms / metrics.totalTranslations,
      averageLoadTime: metrics.averageLoadTime,
      cacheHitRate: metrics.cacheHits / metrics.totalTranslations,
      retryRate: metrics.retryCount / metrics.totalTranslations
    };
  }
}

export const warmingMetrics = WarmingMetricsTracker.getInstance(); 