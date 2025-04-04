import { AggregatedMetricsExporter } from '@/utils/i18n/aggregatedMetricsExport';
import { dataAggregator } from '@/utils/i18n/dataAggregator';

jest.mock('@/utils/i18n/dataAggregator', () => ({
  dataAggregator: {
    getAggregatedMetrics: jest.fn(),
    getMetricsSummary: jest.fn()
  }
}));

describe('AggregatedMetricsExporter', () => {
  const mockMetrics = [{
    timestamp: Date.now(),
    period: 'hour',
    metrics: {
      totalTranslations: 100,
      successRate: 0.9,
      cacheHitRate: 0.8,
      retryRate: 2.5,
      averageLoadTime: 50,
      memoryUsage: 1024 * 1024,
      totalSize: 2048 * 1024
    }
  }];

  const mockSummary = {
    totalSize: '1 MB',
    metricsCount: 1,
    oldestData: new Date('2024-01-01'),
    newestData: new Date('2024-01-02')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (dataAggregator.getAggregatedMetrics as jest.Mock).mockReturnValue(mockMetrics);
    (dataAggregator.getMetricsSummary as jest.Mock).mockReturnValue(mockSummary);
  });

  it('should generate CSV with metrics and summary', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const clickSpy = jest.fn();
    const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');

    const mockLink = {
      href: '',
      download: '',
      click: clickSpy
    };

    createElementSpy.mockReturnValue(mockLink as any);

    await AggregatedMetricsExporter.exportMetrics({
      format: 'csv',
      period: 'hour',
      includeSummary: true
    });

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });

  it('should generate JSON with metrics and summary', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const clickSpy = jest.fn();
    const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');

    const mockLink = {
      href: '',
      download: '',
      click: clickSpy
    };

    createElementSpy.mockReturnValue(mockLink as any);

    await AggregatedMetricsExporter.exportMetrics({
      format: 'json',
      period: 'hour',
      includeSummary: true
    });

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });

  it('should handle export without summary', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };

    createElementSpy.mockReturnValue(mockLink as any);

    await AggregatedMetricsExporter.exportMetrics({
      format: 'csv',
      period: 'hour',
      includeSummary: false
    });

    expect(dataAggregator.getMetricsSummary).not.toHaveBeenCalled();
  });

  it('should use correct file extensions and mime types', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };

    createElementSpy.mockReturnValue(mockLink as any);

    // Test CSV export
    await AggregatedMetricsExporter.exportMetrics({
      format: 'csv',
      period: 'hour'
    });

    expect(mockLink.download).toMatch(/\.csv$/);
    expect(mockLink.href).toMatch(/^blob:.*text\/csv/);

    // Test JSON export
    await AggregatedMetricsExporter.exportMetrics({
      format: 'json',
      period: 'hour'
    });

    expect(mockLink.download).toMatch(/\.json$/);
    expect(mockLink.href).toMatch(/^blob:.*application\/json/);
  });
}); 