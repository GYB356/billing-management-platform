import { render, screen } from '@testing-library/react';
import { StrategyComparison } from '@/components/i18n/StrategyComparison';
import { WarmingMetrics } from '@/utils/i18n/warmingMetrics';

describe('StrategyComparison', () => {
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
      totalSize: 1024 * 1024, // 1MB
      memoryUsage: 2 * 1024 * 1024, // 2MB
    },
    {
      strategyPriority: 2,
      languages: ['fr', 'de'],
      namespaces: ['common', 'settings'],
      totalTranslations: 80,
      successfulWarms: 70,
      failedWarms: 10,
      cacheHits: 60,
      cacheMisses: 20,
      retryCount: 3,
      averageLoadTime: 300,
      totalSize: 512 * 1024, // 512KB
      memoryUsage: 1 * 1024 * 1024, // 1MB
    },
  ];

  it('renders strategy comparison table', () => {
    render(<StrategyComparison metrics={mockMetrics} />);
    
    // Check table headers
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Avg Load Time')).toBeInTheDocument();
  });

  it('sorts strategies by efficiency', () => {
    render(<StrategyComparison metrics={mockMetrics} />);
    
    const rows = screen.getAllByRole('row');
    // First row is header, so we check the second row (first strategy)
    expect(rows[1]).toHaveTextContent('Strategy 2'); // More efficient strategy should be first
  });

  it('calculates efficiency correctly', () => {
    render(<StrategyComparison metrics={mockMetrics} />);
    
    // Strategy 2 should have higher efficiency due to better metrics
    const efficiencyCell = screen.getByText('Strategy 2').closest('tr')?.querySelector('td:nth-child(2)');
    expect(efficiencyCell).toHaveTextContent(/(\d+\.\d+)%/);
  });

  it('handles empty metrics array', () => {
    render(<StrategyComparison metrics={[]} />);
    expect(screen.getByText('Strategy Comparison')).toBeInTheDocument();
  });
});