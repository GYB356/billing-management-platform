export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    swap: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  requests: {
    total: number;
    success: number;
    failed: number;
    averageLatency: number;
  };
  database: {
    queries: number;
    slowQueries: number;
    averageLatency: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  externalServices: Record<string, {
    requests: number;
    errors: number;
    averageLatency: number;
  }>;
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
}

export interface TranslationMetrics {
  language: string;
  loadTime: number;
  bundleSize: number;
  hasError: boolean;
  timestamp: number;
}

export interface I18nMetrics {
  translations: TranslationMetrics[];
  bundleOptimizations: {
    language: string;
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
  }[];
  averageLoadTime: number;
  cacheHitRate: number;
  totalBundleSize: number;
  averageCompressionRatio: number;
} 