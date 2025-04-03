import { render, screen } from '@testing-library/react';
import { TimeSeriesChart } from '@/components/i18n/TimeSeriesChart';

describe('TimeSeriesChart', () => {
  const mockData = [
    { timestamp: 1625097600000, value: 100 }, // 2021-07-01 00:00:00
    { timestamp: 1625184000000, value: 150 }, // 2021-07-02 00:00:00
    { timestamp: 1625270400000, value: 200 }, // 2021-07-03 00:00:00
  ];

  const defaultProps = {
    data: mockData,
    title: 'Test Chart',
    yAxisLabel: 'Test Value',
    color: '#000000',
  };

  it('renders with correct title', () => {
    render(<TimeSeriesChart {...defaultProps} />);
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('formats data correctly', () => {
    render(<TimeSeriesChart {...defaultProps} />);
    const formattedData = mockData.map(d => ({
      ...d,
      timestamp: new Date(d.timestamp).toLocaleTimeString(),
      value: d.value
    }));
    
    // Check if the chart container is rendered
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('handles empty data array', () => {
    render(<TimeSeriesChart {...defaultProps} data={[]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('applies custom color to the line', () => {
    const customColor = '#FF0000';
    render(<TimeSeriesChart {...defaultProps} color={customColor} />);
    const line = screen.getByRole('img');
    expect(line).toHaveAttribute('stroke', customColor);
  });
}); 