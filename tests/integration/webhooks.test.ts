import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/webhooks/route';
import { db } from '@/lib/db';
import { eventManager } from '@/lib/events/events';

jest.mock('@/lib/db', () => ({
  db: {
    paymentMethod: {
      create: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn()
    },
    user: {
      update: jest.fn()
    },
  },
}));

jest.mock('@/lib/events/events', () => ({
  eventManager: {
    emit: jest.fn()
  }
}));

const mockedDb = db as jest.Mocked<typeof db>;
const mockedEventManager = eventManager as jest.Mocked<typeof eventManager>;

describe('Webhooks API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle subscription.created event', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'stripe-signature': 'some-signature',
      },
      body: {
        type: 'subscription.created',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            current_period_end: 1672531200,
            items: {
              data: [
                {
                  price: {
                    id: 'price_123',
                    product: 'prod_123'
                  }
                }
              ]
            },
          },
        },
      },
    });

    mockedDb.subscription.findUnique.mockResolvedValue(null);

    const response = await POST(req);
    const jsonResponse = await response.json();

    expect(response.status).toBe(200);
    expect(jsonResponse.message).toBe('Webhook processed');
    expect(mockedDb.subscription.create).toHaveBeenCalled();
    expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.created', expect.anything());
  });

  it('should handle subscription.updated event', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'stripe-signature': 'some-signature',
      },
      body: {
        type: 'subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            current_period_end: 1672531200,
          },
        },
      },
    });
    mockedDb.subscription.findUnique.mockResolvedValue({
      id: 'sub_123',
      stripeSubscriptionId: 'sub_123',
      userId: 'user_123',
      stripeCustomerId: 'cus_123',
      stripePriceId: 'price_123',
      stripeCurrentPeriodEnd: new Date(1672531200 * 1000),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST(req);
    const jsonResponse = await response.json();

    expect(response.status).toBe(200);
    expect(jsonResponse.message).toBe('Webhook processed');
    expect(mockedDb.subscription.update).toHaveBeenCalled();
    expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.updated', expect.anything());
  });

  it('should handle subscription.deleted event', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'stripe-signature': 'some-signature',
      },
      body: {
        type: 'subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'canceled',
          },
        },
      },
    });

    mockedDb.subscription.findUnique.mockResolvedValue({
      id: 'sub_123',
      stripeSubscriptionId: 'sub_123',
      userId: 'user_123',
      stripeCustomerId: 'cus_123',
      stripePriceId: 'price_123',
      stripeCurrentPeriodEnd: new Date(1672531200 * 1000),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await POST(req);
    const jsonResponse = await response.json();

    expect(response.status).toBe(200);
    expect(jsonResponse.message).toBe('Webhook processed');
    expect(mockedDb.subscription.delete).toHaveBeenCalled();
    expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.canceled', expect.anything());
  });

  it('should return 400 if invalid event type', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'stripe-signature': 'some-signature',
      },
      body: {
        type: 'invalid.event',
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});