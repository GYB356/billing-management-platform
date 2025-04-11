import { dataAggregator } from '@/utils/i18n/dataAggregator';
import { WarmingMetrics } from '@/utils/i18n/warmingMetrics';

describe('DataAggregator', () => {
  const mockMetrics: WarmingMetrics[] = [
    {
      totalTranslations: 100,
      successfulWarms: 90,
      failedWarms: 10,
      cacheHits: 80,
      cacheMisses: 20,
      averageLoadTime: 50,
      totalSize: 1024,
      memoryUsage: 512,
      retryCount: 2
    },
    {
      totalTranslations: 200,
      successfulWarms: 180,
      failedWarms: 20,
      cacheHits: 160,
      cacheMisses: 40,
      averageLoadTime: 60,
      totalSize: 2048,
      memoryUsage: 1024,
      retryCount: 3
    }
  ];

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset data aggregator
    dataAggregator.setConfig({
      maxStorageSize: 100 * 1024 * 1024,
      retentionPeriod: {
        hour: 24,
        day: 30,
        week: 12,
        month: 12
      },
      compressionEnabled: false
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics for different periods', async () => {
      const periods: ('hour' | 'day' | 'week' | 'month')[] = ['hour', 'day', 'week', 'month'];
      
      for (const period of periods) {
        await dataAggregator.aggregateMetrics(mockMetrics, period);
        const aggregated = dataAggregator.getAggregatedMetrics(period);
        
        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].period).toBe(period);
        expect(aggregated[0].metrics).toEqual({
          totalTranslations: 300,
          successfulWarms: 270,
          failedWarms: 30,
          cacheHits: 240,
          cacheMisses: 60,
          averageLoadTime: 55,
          totalSize: 3072,
          memoryUsage: 1536,
          successRate: 0.9,
          cacheHitRate: 0.8,
          retryRate: 2.5
        });
      }
    });

    it('should respect retention periods', async () => {
      // Set short retention period for testing
      dataAggregator.setConfig({
        retentionPeriod: {
          hour: 1,
          day: 1,
          week: 1,
          month: 1
        }
      });

      // Add metrics
      await dataAggregator.aggregateMetrics(mockMetrics, 'hour');
      
      // Simulate time passing
      jest.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 hours
      
      // Add more metrics
      await dataAggregator.aggregateMetrics(mockMetrics, 'hour');
      
      const aggregated = dataAggregator.getAggregatedMetrics('hour');
      expect(aggregated).toHaveLength(1); // Only the newer data should remain
    });

    it('should handle storage size limits', async () => {
      // Set small storage size limit for testing
      dataAggregator.setConfig({
        maxStorageSize: 1000 // 1KB
      });

      // Add metrics until storage is full
      for (let i = 0; i < 10; i++) {
        await dataAggregator.aggregateMetrics(mockMetrics, 'hour');
      }

      const summary = dataAggregator.getMetricsSummary();
      expect(parseInt(summary.totalSize)).toBeLessThanOrEqual(1000);
    });
  });

  describe('storage operations', () => {
    it('should save and load metrics from storage', async () => {
      // Add metrics
      await dataAggregator.aggregateMetrics(mockMetrics, 'hour');
      
      // Create new instance to simulate page reload
      const newAggregator = dataAggregator;
      await newAggregator.loadFromStorage();
      
      const aggregated = newAggregator.getAggregatedMetrics('hour');
      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].metrics.totalTranslations).toBe(300);
    });

    it('should handle storage errors gracefully', async () => {
      // Mock localStorage.setItem to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw error
      await expect(dataAggregator.aggregateMetrics(mockMetrics, 'hour')).resolves.not.toThrow();

      // Restore original implementation
      localStorage.setItem = originalSetItem;
    });
  });

  describe('metrics summary', () => {
    it('should provide accurate metrics summary', async () => {
      // Add metrics with different timestamps
      const now = Date.now();
      const metrics1 = [...mockMetrics];
      const metrics2 = [...mockMetrics];
      
      await dataAggregator.aggregateMetrics(metrics1, 'hour');
      jest.advanceTimersByTime(1000); // 1 second
      await dataAggregator.aggregateMetrics(metrics2, 'hour');

      const summary = dataAggregator.getMetricsSummary();
      
      expect(summary.metricsCount).toBe(2);
      expect(summary.oldestData.getTime()).toBeLessThan(summary.newestData.getTime());
      expect(summary.totalSize).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should apply configuration changes', async () => {
      const newConfig = {
        maxStorageSize: 2000,
        retentionPeriod: {
          hour: 2,
          day: 2,
          week: 2,
          month: 2
        },
        compressionEnabled: true
      };

      dataAggregator.setConfig(newConfig);
      
      // Add metrics
      await dataAggregator.aggregateMetrics(mockMetrics, 'hour');
      
      // Verify storage behavior with new config
      const summary = dataAggregator.getMetricsSummary();
      expect(parseInt(summary.totalSize)).toBeLessThanOrEqual(2000);
    });
  });
}); 