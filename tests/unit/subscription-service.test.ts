import { createSubscription, updateSubscription, cancelSubscription } from '../../lib/services/subscription-service';
import { PrismaClient, Subscription } from '@prisma/client';
import { EventManager } from '../../lib/events/events';

jest.mock('@prisma/client');
jest.mock('../../lib/events/events');

const mockedPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
const mockedEventManager = new EventManager() as jest.Mocked<EventManager>;

describe('Subscription Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    it('should call the database and emit the correct event', async () => {
      const subscriptionData = {
        id: 'sub_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(),
        stripeSubscriptionId: 'stripe_sub_123',
        stripeCustomerId: 'stripe_cust_123'
      } as unknown as Subscription;

      mockedPrisma.subscription.create.mockResolvedValueOnce(subscriptionData);

      await createSubscription(subscriptionData.userId, subscriptionData.planId, subscriptionData.stripeSubscriptionId, subscriptionData.stripeCustomerId);

      expect(mockedPrisma.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: subscriptionData.userId,
          planId: subscriptionData.planId,
          status: 'active',
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
          stripeCustomerId: subscriptionData.stripeCustomerId,
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
      });
      expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.created', {
        id: expect.any(String),
        userId: subscriptionData.userId,
        planId: subscriptionData.planId,
        status: 'active',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        stripeCustomerId: subscriptionData.stripeCustomerId,
      });
    });
  });

  describe('updateSubscription', () => {
    it('should call the database and emit the correct event', async () => {
      const subscriptionData = {
        id: 'sub_123',
        userId: 'user_123',
        planId: 'plan_456',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(),
        stripeSubscriptionId: 'stripe_sub_123',
        stripeCustomerId: 'stripe_cust_123'
      } as unknown as Subscription;

      mockedPrisma.subscription.update.mockResolvedValueOnce(subscriptionData);

      await updateSubscription('sub_123', { planId: 'plan_456' });

      expect(mockedPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        data: { planId: 'plan_456' },
      });
      expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.updated', subscriptionData);
    });
  });

  describe('cancelSubscription', () => {
    it('should call the database and emit the correct event', async () => {
      const subscriptionData = {
        id: 'sub_123',
        userId: 'user_123',
        planId: 'plan_123',
        status: 'canceled',
        startDate: new Date(),
        endDate: new Date(),
        stripeSubscriptionId: 'stripe_sub_123',
        stripeCustomerId: 'stripe_cust_123'
      } as unknown as Subscription;

      mockedPrisma.subscription.update.mockResolvedValueOnce(subscriptionData);

      await cancelSubscription('sub_123', 'user@test.com');

      expect(mockedPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        data: { status: 'canceled' },
      });
      expect(mockedEventManager.emit).toHaveBeenCalledWith('subscription.canceled', {
        id: 'sub_123',
        email: 'user@test.com'
      });
    });
  });
});