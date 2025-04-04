import { performanceMonitor } from './performanceMonitor';

export interface WarmingStrategyConfig {
  priority: number;
  languages: string[];
  namespaces: string[];
  maxSize: number;
  preloadThreshold: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface WarmingConfig {
  strategies: WarmingStrategyConfig[];
  analytics: {
    enabled: boolean;
    endpoint: string;
    batchSize: number;
    flushInterval: number;
  };
  performance: {
    maxMemoryUsage: number;
    maxConcurrentRequests: number;
    timeout: number;
  };
}

class WarmingConfigManager {
  private static instance: WarmingConfigManager;
  private config: WarmingConfig;
  private defaultConfig: WarmingConfig = {
    strategies: [
      {
        priority: 1,
        languages: ['en', 'es', 'fr', 'de'],
        namespaces: ['common', 'auth', 'navigation'],
        maxSize: 2 * 1024 * 1024,
        preloadThreshold: 0.7,
        maxConcurrent: 5,
        retryAttempts: 3,
        retryDelay: 1000
      },
      {
        priority: 2,
        languages: ['pt', 'it', 'nl', 'pl'],
        namespaces: ['common', 'auth'],
        maxSize: 1 * 1024 * 1024,
        preloadThreshold: 0.8,
        maxConcurrent: 3,
        retryAttempts: 2,
        retryDelay: 2000
      }
    ],
    analytics: {
      enabled: true,
      endpoint: '/api/analytics/i18n',
      batchSize: 50,
      flushInterval: 30000
    },
    performance: {
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxConcurrentRequests: 10,
      timeout: 5000
    }
  };

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): WarmingConfigManager {
    if (!WarmingConfigManager.instance) {
      WarmingConfigManager.instance = new WarmingConfigManager();
    }
    return WarmingConfigManager.instance;
  }

  private loadConfig(): WarmingConfig {
    try {
      const savedConfig = localStorage.getItem('i18n_warming_config');
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
      return this.defaultConfig;
    } catch (error) {
      console.error('Failed to load warming config:', error);
      performanceMonitor.trackError(error as Error, 'config');
      return this.defaultConfig;
    }
  }

  saveConfig(config: Partial<WarmingConfig>): void {
    try {
      this.config = {
        ...this.config,
        ...config
      };
      localStorage.setItem('i18n_warming_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save warming config:', error);
      performanceMonitor.trackError(error as Error, 'config');
    }
  }

  getConfig(): WarmingConfig {
    return { ...this.config };
  }

  resetConfig(): void {
    this.config = { ...this.defaultConfig };
    localStorage.removeItem('i18n_warming_config');
  }

  updateStrategy(priority: number, updates: Partial<WarmingStrategyConfig>): void {
    const strategies = this.config.strategies.map(strategy => {
      if (strategy.priority === priority) {
        return { ...strategy, ...updates };
      }
      return strategy;
    });
    this.saveConfig({ strategies });
  }

  addStrategy(strategy: WarmingStrategyConfig): void {
    const strategies = [...this.config.strategies, strategy];
    this.saveConfig({ strategies });
  }

  removeStrategy(priority: number): void {
    const strategies = this.config.strategies.filter(strategy => strategy.priority !== priority);
    this.saveConfig({ strategies });
  }
}

export const warmingConfig = WarmingConfigManager.getInstance(); 