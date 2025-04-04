import { i18nMonitor } from './monitoring';
import { cacheManager } from './cacheManager';
import { progressiveLoader } from './progressiveLoader';

interface PerformanceMetrics {
  timestamp: number;
  translationLoads: {
    total: number;
    averageLoadTime: number;
    cacheHits: number;
    cacheMisses: number;
    totalSize: number;
  };
  cache: {
    hitRate: number;
    totalSize: number;
    evictions: number;
    entries: number;
  };
  chunks: {
    loaded: number;
    total: number;
    averageSize: number;
    preloaded: number;
  };
  memory: {
    used: number;
    total: number;
    peak: number;
  };
  errors: {
    loadErrors: number;
    cacheErrors: number;
    lastError?: {
      message: string;
      timestamp: number;
    };
  };
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  trackError(error: Error, type: string): void {
    console.error(`Performance error (${type}):`, error);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance(); 