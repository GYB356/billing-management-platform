import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import BillingHistory from '@/app/dashboard/billing/page';
import { mockInvoices } from './mocks/data';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Billing History', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: '1' } },
      status: 'authenticated',
    });

    // Mock fetch for billing history
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(mockInvoices),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display billing history', async () => {
    render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText(/\$99.00/i)).toBeInTheDocument();
      expect(screen.getByText(/paid/i)).toBeInTheDocument();
    });
  });

  it('should handle invoice download', async () => {
    render(<BillingHistory />);

    await waitFor(() => {
      const downloadButton = screen.getByRole('button', { name: /download invoice/i });
      fireEvent.click(downloadButton);
    });

    expect(window.open).toHaveBeenCalledWith(mockInvoices[0].pdfUrl, '_blank');
  });

  it('should handle date filtering', async () => {
    render(<BillingHistory />);

    const dateFilter = screen.getByLabelText(/filter by date/i);
    fireEvent.change(dateFilter, { target: { value: 'last-30-days' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/billing/history?period=last-30-days');
    });
  });

  it('should handle status filtering', async () => {
    render(<BillingHistory />);

    const statusFilter = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusFilter, { target: { value: 'paid' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/billing/history?status=paid');
    });
  });

  it('should handle pagination', async () => {
    render(<BillingHistory />);

    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextPageButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/billing/history?page=2');
    });
  });

  it('should handle error states', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed to fetch billing history'));

    render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load billing history/i)).toBeInTheDocument();
    });
  });

  it('should redirect unauthenticated users', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<BillingHistory />);

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
  });

  it('should display empty state when no invoices', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve([]),
    });

    render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText(/no billing history found/i)).toBeInTheDocument();
    });
  });
});