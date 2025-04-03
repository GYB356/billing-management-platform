import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PricingPage from '@/app/pricing/page';
import { mockSubscription } from './mocks/data';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(),
}));

describe('Subscription', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: '1' } },
      status: 'authenticated',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display pricing plans', () => {
    render(<PricingPage />);

    expect(screen.getByText(/basic plan/i)).toBeInTheDocument();
    expect(screen.getByText(/pro plan/i)).toBeInTheDocument();
    expect(screen.getByText(/enterprise plan/i)).toBeInTheDocument();
  });

  it('should handle subscription creation', async () => {
    const mockResponse = {
      subscription: mockSubscription,
      clientSecret: 'test_secret',
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    render(<PricingPage />);

    const subscribeButton = screen.getByRole('button', { name: /subscribe to basic/i });
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_basic',
          planName: 'Basic',
        }),
      });
    });
  });

  it('should handle subscription cancellation', async () => {
    const mockResponse = {
      success: true,
      subscription: { ...mockSubscription, status: 'canceled' },
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    render(<PricingPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel subscription/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/subscription/cancel', {
        method: 'POST',
      });
    });

    expect(screen.getByText(/subscription canceled/i)).toBeInTheDocument();
  });

  it('should handle subscription errors', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Subscription failed'));

    render(<PricingPage />);

    const subscribeButton = screen.getByRole('button', { name: /subscribe to basic/i });
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create subscription/i)).toBeInTheDocument();
    });
  });

  it('should redirect to login for unauthenticated users', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<PricingPage />);

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
  });
}); 