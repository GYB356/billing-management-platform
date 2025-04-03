import { render, screen, act } from '@testing-library/react';
import { WarmingAnalytics } from '@/components/i18n/WarmingAnalytics';
import { performanceAlerts } from '@/utils/i18n/performanceAlerts';
import { warmingMetrics } from '@/utils/i18n/warmingMetrics';

describe('Performance Monitoring Integration', () => {
  const mockMetrics = [
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
    jest.useFakeTimers();
    performanceAlerts.clearAlerts();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates metrics and checks for alerts periodically', () => {
    render(<WarmingAnalytics />);

    // Initial render
    expect(screen.getByText('Performance Overview')).toBeInTheDocument();

    // Simulate metrics update
    act(() => {
      warmingMetrics.updateMetrics(mockMetrics);
    });

    // Check if metrics are displayed
    expect(screen.getByText(/90%/)).toBeInTheDocument(); // Success rate
    expect(screen.getByText(/80%/)).toBeInTheDocument(); // Cache hit rate

    // Simulate performance issue
    const metricsWithIssue = [{
      ...mockMetrics[0],
      successfulWarms: 70, // Low success rate
      cacheHits: 50, // Low cache hit rate
    }];

    act(() => {
      warmingMetrics.updateMetrics(metricsWithIssue);
      performanceAlerts.checkMetrics(metricsWithIssue);
    });

    // Check if alerts are displayed
    expect(screen.getByText(/Low success rate/)).toBeInTheDocument();
    expect(screen.getByText(/Low cache hit rate/)).toBeInTheDocument();

    // Simulate recovery
    act(() => {
      warmingMetrics.updateMetrics(mockMetrics);
      performanceAlerts.checkMetrics(mockMetrics);
    });

    // Check if alerts are cleared
    expect(screen.queryByText(/Low success rate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Low cache hit rate/)).not.toBeInTheDocument();
  });

  it('handles real-time updates and chart rendering', () => {
    render(<WarmingAnalytics />);

    // Simulate multiple metric updates
    const updates = [
      { ...mockMetrics[0], successfulWarms: 85 },
      { ...mockMetrics[0], successfulWarms: 90 },
      { ...mockMetrics[0], successfulWarms: 95 },
    ];

    updates.forEach(metrics => {
      act(() => {
        warmingMetrics.updateMetrics([metrics]);
        jest.advanceTimersByTime(5000); // Advance 5 seconds
      });
    });

    // Check if charts are updated
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('exports metrics data', () => {
    render(<WarmingAnalytics />);

    // Set up metrics
    act(() => {
      warmingMetrics.updateMetrics(mockMetrics);
    });

    // Find and click export button
    const exportButton = screen.getByRole('button', { name: /export/i });
    act(() => {
      exportButton.click();
    });

    // Check if download was triggered
    expect(document.createElement).toHaveBeenCalledWith('a');
  });
}); 