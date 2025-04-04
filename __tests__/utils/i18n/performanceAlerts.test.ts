import { performanceAlerts } from '@/utils/i18n/performanceAlerts';
import { WarmingMetrics } from '@/utils/i18n/warmingMetrics';

describe('performanceAlerts', () => {
  const mockMetrics: WarmingMetrics[] = [
    {
      strategyPriority: 1,
      languages: ['en', 'es'],
      namespaces: ['common', 'auth'],
      totalTranslations: 100,
      successfulWarms: 90,
      failedWarms: 10,
      cacheHits: 80,
      cacheMisses: 20,
      retryCount: 5,
      averageLoadTime: 500,
      totalSize: 1024 * 1024,
      memoryUsage: 2 * 1024 * 1024,
    },
  ];

  beforeEach(() => {
    performanceAlerts.clearAlerts();
  });

  it('detects low success rate alert', () => {
    const metricsWithLowSuccess = [{
      ...mockMetrics[0],
      successfulWarms: 70, // 70% success rate
    }];

    const alerts = performanceAlerts.checkMetrics(metricsWithLowSuccess);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].threshold.metric).toBe('successfulWarms');
    expect(alerts[0].threshold.severity).toBe('warning');
  });

  it('detects low cache hit rate alert', () => {
    const metricsWithLowCacheHits = [{
      ...mockMetrics[0],
      cacheHits: 50, // 50% cache hit rate
    }];

    const alerts = performanceAlerts.checkMetrics(metricsWithLowCacheHits);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].threshold.metric).toBe('cacheHits');
    expect(alerts[0].threshold.severity).toBe('warning');
  });

  it('detects high load time alert', () => {
    const metricsWithHighLoadTime = [{
      ...mockMetrics[0],
      averageLoadTime: 1500, // 1.5 seconds
    }];

    const alerts = performanceAlerts.checkMetrics(metricsWithHighLoadTime);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].threshold.metric).toBe('averageLoadTime');
    expect(alerts[0].threshold.severity).toBe('warning');
  });

  it('detects high memory usage alert', () => {
    const metricsWithHighMemory = [{
      ...mockMetrics[0],
      memoryUsage: 100 * 1024 * 1024, // 100MB
    }];

    const alerts = performanceAlerts.checkMetrics(metricsWithHighMemory);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].threshold.metric).toBe('memoryUsage');
    expect(alerts[0].threshold.severity).toBe('error');
  });

  it('allows custom threshold configuration', () => {
    const customThresholds = [
      {
        metric: 'successfulWarms',
        operator: '<',
        value: 0.9,
        severity: 'error',
        message: 'Critical: Low success rate',
      },
    ];

    performanceAlerts.setThresholds(customThresholds);
    const alerts = performanceAlerts.checkMetrics(mockMetrics);
    expect(alerts.length).toBe(0); // No alerts because metrics meet threshold
  });

  it('clears alerts correctly', () => {
    const metricsWithAlerts = [{
      ...mockMetrics[0],
      successfulWarms: 70,
      cacheHits: 50,
    }];

    performanceAlerts.checkMetrics(metricsWithAlerts);
    expect(performanceAlerts.getActiveAlerts().length).toBeGreaterThan(0);

    performanceAlerts.clearAlerts();
    expect(performanceAlerts.getActiveAlerts().length).toBe(0);
  });

  it('handles multiple alerts for different metrics', () => {
    const metricsWithMultipleIssues = [{
      ...mockMetrics[0],
      successfulWarms: 70,
      cacheHits: 50,
      averageLoadTime: 1500,
    }];

    const alerts = performanceAlerts.checkMetrics(metricsWithMultipleIssues);
    expect(alerts.length).toBeGreaterThan(1);
    expect(alerts.map(a => a.threshold.metric)).toContain('successfulWarms');
    expect(alerts.map(a => a.threshold.metric)).toContain('cacheHits');
    expect(alerts.map(a => a.threshold.metric)).toContain('averageLoadTime');
  });
}); 