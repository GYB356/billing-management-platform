import { exportMetrics, downloadMetrics } from '@/utils/i18n/metricsExport';
import { WarmingMetrics } from '@/utils/i18n/warmingMetrics';

describe('metricsExport', () => {
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

  describe('exportMetrics', () => {
    it('exports metrics in JSON format', () => {
      const result = exportMetrics(mockMetrics, { format: 'json' });
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(mockMetrics);
    });

    it('exports metrics in CSV format', () => {
      const result = exportMetrics(mockMetrics, { format: 'csv' });
      const lines = result.split('\n');
      expect(lines.length).toBe(2); // Header + 1 data row
      expect(lines[0]).toContain('Strategy Priority');
      expect(lines[1]).toContain('1');
    });

    it('handles empty metrics array', () => {
      const jsonResult = exportMetrics([], { format: 'json' });
      expect(jsonResult).toBe('[]');

      const csvResult = exportMetrics([], { format: 'csv' });
      const lines = csvResult.split('\n');
      expect(lines.length).toBe(1); // Only header
    });

    it('includes all required fields in CSV export', () => {
      const result = exportMetrics(mockMetrics, { format: 'csv' });
      const headers = result.split('\n')[0].split(',');
      const expectedHeaders = [
        'Strategy Priority',
        'Languages',
        'Namespaces',
        'Total Translations',
        'Successful Warms',
        'Failed Warms',
        'Cache Hits',
        'Cache Misses',
        'Retry Count',
        'Average Load Time',
        'Total Size',
        'Memory Usage'
      ];
      expect(headers).toEqual(expectedHeaders);
    });
  });

  describe('downloadMetrics', () => {
    let createElementSpy: jest.SpyInstance;
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;
    let clickSpy: jest.SpyInstance;
    let revokeObjectURLSpy: jest.SpyInstance;

    beforeEach(() => {
      createElementSpy = jest.spyOn(document, 'createElement');
      appendChildSpy = jest.spyOn(document.body, 'appendChild');
      removeChildSpy = jest.spyOn(document.body, 'removeChild');
      clickSpy = jest.fn();
      revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');

      const mockAnchor = {
        href: '',
        download: '',
        click: clickSpy,
      };
      createElementSpy.mockReturnValue(mockAnchor);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('creates and triggers download for JSON format', () => {
      downloadMetrics(mockMetrics, { format: 'json' });
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('creates and triggers download for CSV format', () => {
      downloadMetrics(mockMetrics, { format: 'csv' });
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('sets correct file extension in download', () => {
      const jsonDownload = downloadMetrics(mockMetrics, { format: 'json' });
      expect(jsonDownload).toMatch(/\.json$/);

      const csvDownload = downloadMetrics(mockMetrics, { format: 'csv' });
      expect(csvDownload).toMatch(/\.csv$/);
    });
  });
}); 