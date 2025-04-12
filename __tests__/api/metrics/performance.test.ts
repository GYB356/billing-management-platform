import { createMocks } from 'node-mocks-http';
import { GET } from '@/app/api/metrics/performance/route';
import { MonitoringService } from '@/lib/services/monitoring-service';
import { i18nMonitor } from '@/utils/i18n/monitoring';

// Mock dependencies
jest.mock('@/lib/services/monitoring-service');
jest.mock('@/utils/i18n/monitoring');

describe('/api/metrics/performance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return formatted metrics', async () => {
    // Mock MonitoringService
    const mockMetrics = {
      timestamp: new Date(),
      cpu: { usage: 0.5, cores: 4, load: [0.5] },
      memory: { total: 8000, used: 4000, free: 4000 },
      requests: { total: 100, success: 95, failed: 5, averageLatency: 200 },
      database: { queries: 50, slowQueries: 2, averageLatency: 100, errors: 1 },
      cache: { hits: 80, misses: 20, hitRate: 0.8, size: 1024 },
      externalServices: {},
    };

    (MonitoringService.getInstance as jest.Mock).mockReturnValue({
      getPerformanceMetrics: jest.fn().mockResolvedValue(mockMetrics),
    });

    // Mock i18nMonitor
    const mockI18nMetrics = {
      translations: [
        { language: 'en', loadTime: 100, bundleSize: 50000, hasError: false },
        { language: 'fr', loadTime: 120, bundleSize: 48000, hasError: true },
      ],
      cacheHitRate: 0.85,
      totalBundleSize: 98000,
      averageCompressionRatio: 0.6,
      bundleOptimizations: [],
      averageLoadTime: 110,
    };

    (i18nMonitor.getMetrics as jest.Mock).mockReturnValue(mockI18nMetrics);

    const { req, res } = createMocks({
      method: 'GET',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      system: {
        cpu: [50], // 0.5 * 100
        memory: [50], // (4000 / 8000) * 100
        requests: [100],
        latency: [200],
      },
      i18n: {
        loadTimes: [100, 120],
        cacheHits: [0.85],
        bundleSize: [98000],
        errors: 1,
      },
      timestamps: expect.any(Array),
    });

    expect(data.timestamps).toHaveLength(12);
    expect(new Date(data.timestamps[0]).getTime()).toBeLessThan(new Date(data.timestamps[1]).getTime());
  });

  it('should handle errors gracefully', async () => {
    (MonitoringService.getInstance as jest.Mock).mockReturnValue({
      getPerformanceMetrics: jest.fn().mockRejectedValue(new Error('Service error')),
    });

    const { req, res } = createMocks({
      method: 'GET',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Failed to fetch performance metrics',
    });
  });

  it('should handle missing i18n metrics', async () => {
    // Mock MonitoringService with valid data
    const mockMetrics = {
      timestamp: new Date(),
      cpu: { usage: 0.5, cores: 4, load: [0.5] },
      memory: { total: 8000, used: 4000, free: 4000 },
      requests: { total: 100, success: 95, failed: 5, averageLatency: 200 },
      database: { queries: 50, slowQueries: 2, averageLatency: 100, errors: 1 },
      cache: { hits: 80, misses: 20, hitRate: 0.8, size: 1024 },
      externalServices: {},
    };

    (MonitoringService.getInstance as jest.Mock).mockReturnValue({
      getPerformanceMetrics: jest.fn().mockResolvedValue(mockMetrics),
    });

    // Mock i18nMonitor with null metrics
    (i18nMonitor.getMetrics as jest.Mock).mockReturnValue(null);

    const { req, res } = createMocks({
      method: 'GET',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.system).toBeDefined();
    expect(data.i18n).toEqual({
      loadTimes: [],
      cacheHits: [0],
      bundleSize: [0],
      errors: 0,
    });
  });

  it('should validate timestamp format', async () => {
    // Mock services with valid data
    const mockMetrics = {
      timestamp: new Date(),
      cpu: { usage: 0.5, cores: 4, load: [0.5] },
      memory: { total: 8000, used: 4000, free: 4000 },
      requests: { total: 100, success: 95, failed: 5, averageLatency: 200 },
      database: { queries: 50, slowQueries: 2, averageLatency: 100, errors: 1 },
      cache: { hits: 80, misses: 20, hitRate: 0.8, size: 1024 },
      externalServices: {},
    };

    (MonitoringService.getInstance as jest.Mock).mockReturnValue({
      getPerformanceMetrics: jest.fn().mockResolvedValue(mockMetrics),
    });

    const mockI18nMetrics = {
      translations: [],
      cacheHitRate: 0.85,
      totalBundleSize: 98000,
      averageCompressionRatio: 0.6,
      bundleOptimizations: [],
      averageLoadTime: 110,
    };

    (i18nMonitor.getMetrics as jest.Mock).mockReturnValue(mockI18nMetrics);

    const { req, res } = createMocks({
      method: 'GET',
    });

    const response = await GET();
    const data = await response.json();

    // Validate timestamp format
    data.timestamps.forEach((timestamp: string) => {
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
    });
  });
}); 