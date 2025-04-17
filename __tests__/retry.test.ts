import { createMocks } from 'node-mocks-http';
import { getServerSession } from 'next-auth';
import handler from '@/pages/api/billing/retry';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    invoices: {
      retrieve: jest.fn(),
      pay: jest.fn(),
    },
  }));
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    retryAttempt: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('/api/billing/retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if not logged in', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { invoiceId: 'inv_123' },
    });

    (getServerSession as jest.Mock).mockResolvedValue(null);

    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('validates method', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('handles successful retry', async () => {
    const mockSession = {
      user: { id: 'user_123', email: 'test@example.com' },
    };

    const mockInvoice = {
      id: 'inv_123',
      status: 'paid',
      payment_intent: 'pi_123',
    };

    const mockRetryAttempt = {
      id: 'retry_123',
      attempts: 1,
      status: 'succeeded',
    };

    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const stripe = new Stripe('fake_key', { apiVersion: '2023-10-16' });
    stripe.invoices.retrieve.mockResolvedValue(mockInvoice);
    stripe.invoices.pay.mockResolvedValue({ ...mockInvoice, status: 'paid' });

    (prisma.retryAttempt.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.retryAttempt.upsert as jest.Mock).mockResolvedValue(mockRetryAttempt);

    const { req, res } = createMocks({
      method: 'POST',
      body: { invoiceId: 'inv_123' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      attempt: mockRetryAttempt,
      invoice: { ...mockInvoice, status: 'paid' },
    });
  });

  it('handles maximum retry attempts exceeded', async () => {
    const mockSession = {
      user: { id: 'user_123', email: 'test@example.com' },
    };

    (getServerSession as jest.Mock).mockResolvedValue(mockSession);

    const mockExistingAttempt = {
      id: 'retry_123',
      attempts: 3,
      status: 'failed',
    };

    (prisma.retryAttempt.findUnique as jest.Mock).mockResolvedValue(mockExistingAttempt);

    const { req, res } = createMocks({
      method: 'POST',
      body: { invoiceId: 'inv_123' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Maximum retry attempts exceeded',
      attempts: 3,
    });
  });
});