import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/stripe/webhook';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      create: jest.fn(),
    },
  },
}));

describe('Stripe Webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 if signature is invalid', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'stripe-signature': 'bad_sig' },
    });

    const mockStripe = new Stripe('fake_key', { apiVersion: '2023-10-16' });
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });

  it('should handle payment_intent.succeeded event', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'stripe-signature': 'valid_sig' },
    });

    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            userId: 'user_123',
          },
        },
      },
    };

    const mockStripe = new Stripe('fake_key', { apiVersion: '2023-10-16' });
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ received: true });
  });
}); 