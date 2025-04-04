interface TranslationMetrics {
  language: string;
  loadTime: number;
  cacheHit: boolean;
  bundleSize: number;
  timestamp: number;
}

interface BundleOptimizationMetrics {
  language: string;
  namespace: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  optimizationTime: number;
  bundleCount: number;
}

interface PerformanceMetrics {
  translations: TranslationMetrics[];
  bundleOptimizations: BundleOptimizationMetrics[];
  averageLoadTime: number;
  cacheHitRate: number;
  totalBundleSize: number;
  averageCompressionRatio: number;
}

interface OptimizationMetrics {
  language: string;
  namespace: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  optimizationTime: number;
  bundleCount: number;
}

class I18nMonitor {
  private static instance: I18nMonitor;
  private metrics: TranslationMetrics[] = [];
  private bundleOptimizations: BundleOptimizationMetrics[] = [];
  private readonly STORAGE_KEY = 'i18n_performance_metrics';

  private constructor() {
    this.loadMetrics();
  }

  static getInstance(): I18nMonitor {
    if (!I18nMonitor.instance) {
      I18nMonitor.instance = new I18nMonitor();
    }
    return I18nMonitor.instance;
  }

  private loadMetrics(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.metrics = parsed.translations || [];
        this.bundleOptimizations = parsed.bundleOptimizations || [];
      }
    } catch (error) {
      console.error('Failed to load i18n metrics:', error);
    }
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        translations: this.metrics,
        bundleOptimizations: this.bundleOptimizations
      }));
    } catch (error) {
      console.error('Failed to save i18n metrics:', error);
    }
  }

  trackTranslationLoad(
    language: string,
    loadTime: number,
    cacheHit: boolean,
    bundleSize: number
  ): void {
    const metric: TranslationMetrics = {
      language,
      loadTime,
      cacheHit,
      bundleSize,
      timestamp: Date.now()
    };

    this.metrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    this.saveMetrics();
    this.reportMetrics();
  }

  trackBundleOptimization(metrics: OptimizationMetrics): void {
    console.log('Bundle optimization metrics:', metrics);
  }

  trackError(error: Error, context: string): void {
    console.error(`I18n error (${context}):`, error);
  }

  trackLoadTime(language: string, namespace: string, timeMs: number): void {
    console.log(`Translation load time: ${timeMs}ms for ${language}/${namespace}`);
  }

  getMetrics(): PerformanceMetrics {
    const totalLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0);
    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const totalBundleSize = this.metrics.reduce((sum, m) => sum + m.bundleSize, 0);
    const averageCompressionRatio = this.bundleOptimizations.length > 0
      ? this.bundleOptimizations.reduce((sum, m) => sum + m.compressionRatio, 0) / this.bundleOptimizations.length
      : 0;

    return {
      translations: this.metrics,
      bundleOptimizations: this.bundleOptimizations,
      averageLoadTime: totalLoadTime / this.metrics.length,
      cacheHitRate: (cacheHits / this.metrics.length) * 100,
      totalBundleSize,
      averageCompressionRatio
    };
  }

  private reportMetrics(): void {
    const metrics = this.getMetrics();
    
    // Log metrics for monitoring
    console.log('I18n Performance Metrics:', {
      averageLoadTime: `${metrics.averageLoadTime.toFixed(2)}ms`,
      cacheHitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
      totalBundleSize: `${(metrics.totalBundleSize / 1024).toFixed(2)}KB`,
      averageCompressionRatio: `${(metrics.averageCompressionRatio * 100).toFixed(1)}%`
    });

    // Send metrics to analytics service if configured
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true') {
      this.sendToAnalytics(metrics);
    }
  }

  private async sendToAnalytics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await fetch('/api/analytics/i18n', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metrics)
      });
    } catch (error) {
      console.error('Failed to send i18n metrics to analytics:', error);
    }
  }

  clearMetrics(): void {
    this.metrics = [];
    this.bundleOptimizations = [];
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const i18nMonitor = I18nMonitor.getInstance();