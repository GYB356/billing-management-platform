import { createMocks } from 'node-mocks-http';
import { POST, PATCH } from '@/app/api/subscriptions/route';
import { createSubscription, updateSubscription, cancelSubscription } from '@/lib/services/subscription-service';
import { EventManager } from '@/lib/events/events';

jest.mock('@/lib/services/subscription-service');
jest.mock('@/lib/events/events');

describe('/api/subscriptions', () => {
  let eventManagerMock: jest.Mocked<EventManager>;
  beforeEach(() => {
    jest.clearAllMocks();
    eventManagerMock = new EventManager() as jest.Mocked<EventManager>;
    (EventManager as jest.Mock).mockReturnValue(eventManagerMock);
  });

  describe('POST /api/subscriptions', () => {
    it('should create a new subscription and return 201', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-id',
          planId: 'plan-id',
          paymentMethodId: 'payment-method-id',
        },
      });

      (createSubscription as jest.Mock).mockResolvedValue({ id: 'subscription-id' });
      const response = await POST(req);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: 'subscription-id' });
      expect(createSubscription).toHaveBeenCalledWith({
        userId: 'user-id',
        planId: 'plan-id',
        paymentMethodId: 'payment-method-id',
      });
      expect(eventManagerMock.emit).toHaveBeenCalledWith('subscription.created', { id: 'subscription-id' });
    });

    it('should return 400 if the body is invalid', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {},
      });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should return 500 if create subscription fails', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-id',
          planId: 'plan-id',
          paymentMethodId: 'payment-method-id',
        },
      });
      (createSubscription as jest.Mock).mockRejectedValue(new Error('Error'));
      const response = await POST(req);
      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/subscriptions', () => {
    it('should update a subscription and return 200', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        body: {
          subscriptionId: 'subscription-id',
          planId: 'new-plan-id',
        },
      });

      (updateSubscription as jest.Mock).mockResolvedValue({ id: 'subscription-id', planId: 'new-plan-id' });
      const response = await PATCH(req);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'subscription-id', planId: 'new-plan-id' });
      expect(updateSubscription).toHaveBeenCalledWith('subscription-id', 'new-plan-id');
      expect(eventManagerMock.emit).toHaveBeenCalledWith('subscription.updated', { id: 'subscription-id', planId: 'new-plan-id' });
    });

    it('should cancel a subscription and return 200', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        body: {
          subscriptionId: 'subscription-id',
          cancel: true
        },
      });

      (cancelSubscription as jest.Mock).mockResolvedValue({ id: 'subscription-id' });
      const response = await PATCH(req);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'subscription-id' });
      expect(cancelSubscription).toHaveBeenCalledWith('subscription-id');
      expect(eventManagerMock.emit).toHaveBeenCalledWith('subscription.canceled', { id: 'subscription-id' });
    });

    it('should return 400 if the body is invalid', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        body: {},
      });
      const response = await PATCH(req);
      expect(response.status).toBe(400);
    });

    it('should return 500 if update subscription fails', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        body: {
          subscriptionId: 'subscription-id',
          planId: 'new-plan-id',
        },
      });
      (updateSubscription as jest.Mock).mockRejectedValue(new Error('Error'));
      const response = await PATCH(req);
      expect(response.status).toBe(500);
    });

    it('should return 500 if cancel subscription fails', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        body: {
          subscriptionId: 'subscription-id',
          cancel: true,
        },
      });
      (cancelSubscription as jest.Mock).mockRejectedValue(new Error('Error'));
      const response = await PATCH(req);
      expect(response.status).toBe(500);
    });
  });
});