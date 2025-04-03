import { WarmingMetrics } from './warmingMetrics';
import { warmingMetrics } from './warmingMetrics';
import { performanceAlerts } from './performanceAlerts';

interface OptimizationConfig {
  maxMemoryUsage: number;
  targetCacheHitRate: number;
  maxLoadTime: number;
  chunkSize: number;
  preloadThreshold: number;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private config: OptimizationConfig;
  private isOptimizing: boolean = false;

  private constructor() {
    this.config = {
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      targetCacheHitRate: 0.8,
      maxLoadTime: 1000, // 1 second
      chunkSize: 100,
      preloadThreshold: 0.7 // 70% usage threshold
    };
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  setConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async optimize(): Promise<void> {
    if (this.isOptimizing) return;
    this.isOptimizing = true;

    try {
      await this.optimizeMemoryUsage();
      await this.optimizeCachePerformance();
      await this.optimizeLoadTimes();
      await this.optimizePreloading();
    } finally {
      this.isOptimizing = false;
    }
  }

  private async optimizeMemoryUsage(): Promise<void> {
    const metrics = warmingMetrics.getMetrics();
    
    if (metrics.memoryUsage > this.config.maxMemoryUsage) {
      // Clear old cache entries
      await this.evictOldCacheEntries();
      
      // Compress translations if needed
      if (metrics.memoryUsage > this.config.maxMemoryUsage) {
        await this.compressTranslations();
      }
    }
  }

  private async optimizeCachePerformance(): Promise<void> {
    const metrics = warmingMetrics.getMetrics();
    const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);

    if (cacheHitRate < this.config.targetCacheHitRate) {
      // Analyze frequently used translations
      const frequentlyUsed = await this.analyzeFrequentlyUsedTranslations();
      
      // Prioritize warming for frequently used translations
      await this.prioritizeWarming(frequentlyUsed);
    }
  }

  private async optimizeLoadTimes(): Promise<void> {
    const metrics = warmingMetrics.getMetrics();
    
    if (metrics.averageLoadTime > this.config.maxLoadTime) {
      // Implement chunking for large translation sets
      await this.implementChunking();
      
      // Optimize bundle sizes
      await this.optimizeBundles();
    }
  }

  private async optimizePreloading(): Promise<void> {
    const metrics = warmingMetrics.getMetrics();
    const usageRate = metrics.successfulWarms / metrics.totalTranslations;

    if (usageRate > this.config.preloadThreshold) {
      // Preload commonly accessed translations
      await this.preloadCommonTranslations();
    }
  }

  private async evictOldCacheEntries(): Promise<void> {
    const cache = warmingMetrics.getCache();
    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    const entries = Object.entries(cache);
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > MAX_AGE) {
        await warmingMetrics.removeFromCache(key);
      }
    }
  }

  private async compressTranslations(): Promise<void> {
    const translations = warmingMetrics.getPendingTranslations();
    const compressed = await Promise.all(
      translations.map(async translation => ({
        ...translation,
        data: await this.compressData(translation.data)
      }))
    );
    await warmingMetrics.updateTranslations(compressed);
  }

  private async analyzeFrequentlyUsedTranslations(): Promise<string[]> {
    const metrics = warmingMetrics.getMetrics();
    const usage = new Map<string, number>();

    // Analyze translation usage patterns
    metrics.translationUsage.forEach((count, key) => {
      usage.set(key, count);
    });

    // Sort by usage and return top 20%
    return Array.from(usage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.ceil(usage.size * 0.2))
      .map(([key]) => key);
  }

  private async prioritizeWarming(translations: string[]): Promise<void> {
    for (const key of translations) {
      await warmingMetrics.prioritizeWarming(key);
    }
  }

  private async implementChunking(): Promise<void> {
    const translations = warmingMetrics.getPendingTranslations();
    
    for (let i = 0; i < translations.length; i += this.config.chunkSize) {
      const chunk = translations.slice(i, i + this.config.chunkSize);
      await warmingMetrics.loadChunk(chunk);
    }
  }

  private async optimizeBundles(): Promise<void> {
    const bundles = warmingMetrics.getBundles();
    
    for (const bundle of bundles) {
      if (bundle.size > this.config.maxLoadTime) {
        await this.splitBundle(bundle);
      }
    }
  }

  private async preloadCommonTranslations(): Promise<void> {
    const commonNamespaces = ['common', 'auth', 'settings'];
    const userLanguage = warmingMetrics.getUserLanguage();
    
    for (const namespace of commonNamespaces) {
      await warmingMetrics.preloadTranslations(userLanguage, namespace);
    }
  }

  private async compressData(data: string): Promise<string> {
    // Implement compression logic here
    // This is a placeholder for actual compression implementation
    return data;
  }

  private async splitBundle(bundle: any): Promise<void> {
    // Implement bundle splitting logic here
    // This is a placeholder for actual bundle splitting implementation
  }

  getOptimizationStatus(): {
    isOptimizing: boolean;
    lastOptimization: Date | null;
    metrics: WarmingMetrics;
  } {
    return {
      isOptimizing: this.isOptimizing,
      lastOptimization: warmingMetrics.getLastOptimization(),
      metrics: warmingMetrics.getMetrics()
    };
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance(); 