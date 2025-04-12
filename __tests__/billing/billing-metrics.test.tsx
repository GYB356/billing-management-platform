import { render, screen, fireEvent } from '@testing-library/react';
import BillingMetrics from '@/app/components/billing/BillingMetrics';

const mockMetrics = [
  {
    id: 'revenue',
    name: 'Monthly Revenue',
    value: 12500,
    unit: 'currency',
    trend: 15.5,
    history: [
      { date: '2024-01-01', value: 10000 },
      { date: '2024-02-01', value: 11200 },
      { date: '2024-03-01', value: 12500 }
    ]
  },
  {
    id: 'api_calls',
    name: 'API Calls',
    value: 1500000,
    unit: 'calls',
    trend: -5.2,
    history: [
      { date: '2024-01-01', value: 1600000 },
      { date: '2024-02-01', value: 1550000 },
      { date: '2024-03-01', value: 1500000 }
    ]
  }
];

describe('BillingMetrics', () => {
  it('renders all metrics', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    mockMetrics.forEach((metric) => {
      expect(screen.getByText(metric.name)).toBeInTheDocument();
    });
  });

  it('formats currency values correctly', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    expect(screen.getByText('$12,500.00')).toBeInTheDocument();
  });

  it('formats non-currency values correctly', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    expect(screen.getByText('1,500,000 calls')).toBeInTheDocument();
  });

  it('displays positive trends with correct styling', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    const positiveTrend = screen.getByText('+15.5%');
    expect(positiveTrend.parentElement).toHaveClass('text-green-500');
  });

  it('displays negative trends with correct styling', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    const negativeTrend = screen.getByText('-5.2%');
    expect(negativeTrend.parentElement).toHaveClass('text-red-500');
  });

  it('renders period selector buttons', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    ['Day', 'Week', 'Month', 'Year'].forEach((period) => {
      expect(screen.getByText(period)).toBeInTheDocument();
    });
  });

  it('highlights selected period button', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    const monthButton = screen.getByText('Month');
    expect(monthButton).toHaveClass('bg-blue-500', 'text-white');
  });

  it('renders charts for each metric', () => {
    render(<BillingMetrics metrics={mockMetrics} period="month" />);
    
    mockMetrics.forEach((metric) => {
      expect(screen.getByText(`${metric.name} Trend`)).toBeInTheDocument();
    });
  });
}); 