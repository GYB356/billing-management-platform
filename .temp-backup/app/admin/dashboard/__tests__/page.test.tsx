import { render, screen, fireEvent } from '@testing-library/react';
import AdminDashboard from '../page';
import { realTimeMetricsService } from '@/lib/services/real-time-metrics';
import { SessionProvider } from 'next-auth/react';

jest.mock('@/lib/services/real-time-metrics', () => ({
  realTimeMetricsService: {
    onMetricsUpdate: jest.fn(),
    onError: jest.fn(),
    startUpdates: jest.fn(),
    stopUpdates: jest.fn(),
    removeListener: jest.fn(),
    removeErrorListener: jest.fn(),
  },
}));

describe('AdminDashboard', () => {
  const mockSession = {
    user: { name: 'Admin', email: 'admin@example.com', role: 'admin' },
    expires: '9999-12-31T23:59:59.999Z',
  };

  it('renders export buttons', () => {
    render(
      <SessionProvider session={mockSession}>
        <AdminDashboard />
      </SessionProvider>
    );

    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
  });

  it('shows error message for unauthorized users', () => {
    const unauthorizedSession = {
      user: { name: 'User', email: 'user@example.com', role: 'user' },
      expires: '9999-12-31T23:59:59.999Z',
    };

    render(
      <SessionProvider session={unauthorizedSession}>
        <AdminDashboard />
      </SessionProvider>
    );

    expect(screen.getByText('Access denied. You do not have permission to view this page.')).toBeInTheDocument();
  });

  it('retries fetching metrics on error', () => {
    render(
      <SessionProvider session={mockSession}>
        <AdminDashboard />
      </SessionProvider>
    );

    fireEvent.click(screen.getByText('Retry'));
    expect(realTimeMetricsService.startUpdates).toHaveBeenCalled();
  });
});