import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

jest.mock('next/router', () => require('next-router-mock'));

jest.mock('@/app/api/pricing/plans/route', () => ({
  default: jest.fn(() => Promise.resolve({
    json: () => Promise.resolve({
      plans: [
        { id: '1', name: 'Basic Plan', description: 'Basic features', price: 1000, interval: 'month' },
        { id: '2', name: 'Pro Plan', description: 'Pro features', price: 2000, interval: 'month' },
        { id: '3', name: 'Enterprise Plan', description: 'Enterprise features', price: 5000, interval: 'month' },
      ],
    }),
  })),
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

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url === '/api/pricing/plans') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plans: [
              { id: '1', name: 'Basic Plan', description: 'Basic features', price: 1000, interval: 'month' },
              { id: '2', name: 'Pro Plan', description: 'Pro features', price: 2000, interval: 'month' },
              { id: '3', name: 'Enterprise Plan', description: 'Enterprise features', price: 5000, interval: 'month' },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display pricing plans', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({
        plans: [
          { id: '1', name: 'Basic Plan', description: 'Basic features', price: 1000, interval: 'month' },
          { id: '2', name: 'Pro Plan', description: 'Pro features', price: 2000, interval: 'month' },
          { id: '3', name: 'Enterprise Plan', description: 'Enterprise features', price: 5000, interval: 'month' },
        ],
      }),
    });

    await act(async () => {
      render(<PricingPage />);
    });

    expect(screen.getByRole('heading', { name: /basic plan/i })).toBeInTheDocument();
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

    await act(async () => {
      render(<PricingPage />);
    });

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

    await act(async () => {
      render(<PricingPage />);
    });

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

    await act(async () => {
      render(<PricingPage />);
    });

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

    act(() => {
      render(<PricingPage />);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
  });
});