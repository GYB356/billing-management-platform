import { WarmingMetrics } from './warmingMetrics';

export interface AlertThreshold {
  metric: keyof WarmingMetrics;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
  severity: 'warning' | 'error';
  message: string;
}

export interface Alert {
  id: string;
  threshold: AlertThreshold;
  triggered: boolean;
  timestamp: number;
  currentValue: number;
}

class PerformanceAlertManager {
  private static instance: PerformanceAlertManager;
  private alerts: Alert[] = [];
  private defaultThresholds: AlertThreshold[] = [
    {
      metric: 'successfulWarms',
      operator: '<',
      value: 0.8, // 80% success rate
      severity: 'warning',
      message: 'Low success rate detected in warming strategy'
    },
    {
      metric: 'cacheHits',
      operator: '<',
      value: 0.6, // 60% cache hit rate
      severity: 'warning',
      message: 'Low cache hit rate detected'
    },
    {
      metric: 'averageLoadTime',
      operator: '>',
      value: 1000, // 1 second
      severity: 'warning',
      message: 'High average load time detected'
    },
    {
      metric: 'memoryUsage',
      operator: '>',
      value: 50 * 1024 * 1024, // 50MB
      severity: 'error',
      message: 'High memory usage detected'
    }
  ];

  private constructor() {}

  static getInstance(): PerformanceAlertManager {
    if (!PerformanceAlertManager.instance) {
      PerformanceAlertManager.instance = new PerformanceAlertManager();
    }
    return PerformanceAlertManager.instance;
  }

  setThresholds(thresholds: AlertThreshold[]): void {
    this.defaultThresholds = thresholds;
    this.alerts = [];
  }

  checkMetrics(metrics: WarmingMetrics[]): Alert[] {
    const newAlerts: Alert[] = [];

    metrics.forEach(metric => {
      this.defaultThresholds.forEach(threshold => {
        const value = metric[threshold.metric];
        const triggered = this.evaluateThreshold(value, threshold);

        if (triggered) {
          newAlerts.push({
            id: `${metric.strategyPriority}-${threshold.metric}`,
            threshold,
            triggered: true,
            timestamp: Date.now(),
            currentValue: value
          });
        }
      });
    });

    this.alerts = newAlerts;
    return newAlerts;
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case '>':
        return value > threshold.value;
      case '<':
        return value < threshold.value;
      case '>=':
        return value >= threshold.value;
      case '<=':
        return value <= threshold.value;
      default:
        return false;
    }
  }

  getActiveAlerts(): Alert[] {
    return this.alerts;
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

export const performanceAlerts = PerformanceAlertManager.getInstance();