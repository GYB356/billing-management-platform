import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AggregatedMetricsView } from '@/components/i18n/AggregatedMetricsView';
import { dataAggregator } from '@/utils/i18n/dataAggregator';
import { WarmingMetrics } from '@/utils/i18n/warmingMetrics';

// Mock the data aggregator
jest.mock('@/utils/i18n/dataAggregator', () => ({
  dataAggregator: {
    getAggregatedMetrics: jest.fn(),
    getMetricsSummary: jest.fn()
  }
}));

describe('AggregatedMetricsView', () => {
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
    }
  ];

  const mockSummary = {
    totalSize: '1 KB',
    metricsCount: 1,
    oldestData: new Date('2024-01-01'),
    newestData: new Date('2024-01-02')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (dataAggregator.getAggregatedMetrics as jest.Mock).mockReturnValue(mockMetrics);
    (dataAggregator.getMetricsSummary as jest.Mock).mockReturnValue(mockSummary);
  });

  it('renders metrics summary', () => {
    render(<AggregatedMetricsView period="hour" />);

    expect(screen.getByText('Total Storage')).toBeInTheDocument();
    expect(screen.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getByText('Metrics Count')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders performance trends chart', () => {
    render(<AggregatedMetricsView period="hour" />);

    expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    expect(screen.getByText('Success Rate (%)')).toBeInTheDocument();
    expect(screen.getByText('Cache Hit Rate (%)')).toBeInTheDocument();
    expect(screen.getByText('Retry Rate')).toBeInTheDocument();
    expect(screen.getByText('Load Time (ms)')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage (MB)')).toBeInTheDocument();
  });

  it('renders latest metrics', () => {
    render(<AggregatedMetricsView period="hour" />);

    expect(screen.getByText('Latest Metrics')).toBeInTheDocument();
    expect(screen.getByText('Translations')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('updates metrics periodically', () => {
    jest.useFakeTimers();

    render(<AggregatedMetricsView period="hour" />);

    // Initial call
    expect(dataAggregator.getAggregatedMetrics).toHaveBeenCalledTimes(1);
    expect(dataAggregator.getMetricsSummary).toHaveBeenCalledTimes(1);

    // Advance time by 5 minutes
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    // Should have been called again
    expect(dataAggregator.getAggregatedMetrics).toHaveBeenCalledTimes(2);
    expect(dataAggregator.getMetricsSummary).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('handles empty metrics gracefully', () => {
    (dataAggregator.getAggregatedMetrics as jest.Mock).mockReturnValue([]);
    
    render(<AggregatedMetricsView period="hour" />);

    expect(screen.getByText('Latest Metrics')).toBeInTheDocument();
    expect(screen.queryByText('Translations')).not.toBeInTheDocument();
  });

  it('formats metrics correctly', () => {
    const metricsWithLargeNumbers = [{
      ...mockMetrics[0],
      totalSize: 1024 * 1024 * 1024, // 1GB
      memoryUsage: 1024 * 1024 * 512, // 512MB
      averageLoadTime: 1000 // 1s
    }];

    (dataAggregator.getAggregatedMetrics as jest.Mock).mockReturnValue(metricsWithLargeNumbers);

    render(<AggregatedMetricsView period="hour" />);

    expect(screen.getByText('1 GB')).toBeInTheDocument();
    expect(screen.getByText('512 MB')).toBeInTheDocument();
    expect(screen.getByText('1s')).toBeInTheDocument();
  });
});