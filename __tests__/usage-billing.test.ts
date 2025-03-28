import { prismaMock } from '../__mocks__/prisma';
import { processUsageRecords, calculateUsageCharges } from '@/lib/usage';

// Mock the Stripe client
jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptionItems: {
      createUsageRecord: jest.fn().mockResolvedValue({ id: 'usage_123' }),
    },
  },
}));

describe('Usage-Based Billing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processUsageRecords', () => {
    it('should process all unreported usage records', async () => {
      // Mock subscriptions with unreported usage
      prismaMock.subscription.findMany.mockResolvedValue([
        {
          id: 'sub_123',
          stripeSubscriptionId: 'sub_stripe_123',
          organization: { stripeCustomerId: 'cus_123' },
          usageRecords: [
            {
              featureId: 'feat_1',
              quantity: 10,
              reportedToStripe: false,
              feature: {
                id: 'feat_1',
                name: 'API Calls',
                metadata: { stripePriceId: 'price_123' },
              },
            },
            {
              featureId: 'feat_1',
              quantity: 5,
              reportedToStripe: false,
              feature: {
                id: 'feat_1',
                name: 'API Calls',
                metadata: { stripePriceId: 'price_123' },
              },
            },
          ],
        },
      ] as any);

      // Mock updating usage records
      prismaMock.usageRecord.updateMany.mockResolvedValue({ count: 2 });

      await processUsageRecords();

      // Verify Stripe was called to create usage record
      const { stripe } = require('@/lib/stripe');
      expect(stripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
        'price_123',
        {
          quantity: 15, // 10 + 5
          timestamp: expect.any(Number),
          action: 'increment',
        }
      );

      // Verify usage records were marked as reported
      expect(prismaMock.usageRecord.updateMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: 'sub_123',
          featureId: 'feat_1',
          reportedToStripe: false,
        },
        data: {
          reportedToStripe: true,
          stripeUsageRecordId: 'usage_123',
        },
      });
    });

    it('should skip subscriptions without Stripe IDs', async () => {
      // Mock subscriptions with unreported usage but no Stripe ID
      prismaMock.subscription.findMany.mockResolvedValue([
        {
          id: 'sub_123',
          stripeSubscriptionId: null,
          organization: { stripeCustomerId: 'cus_123' },
          usageRecords: [
            {
              featureId: 'feat_1',
              quantity: 10,
              reportedToStripe: false,
              feature: {
                id: 'feat_1',
                name: 'API Calls',
                metadata: { stripePriceId: 'price_123' },
              },
            },
          ],
        },
      ] as any);

      await processUsageRecords();

      // Verify Stripe was not called
      const { stripe } = require('@/lib/stripe');
      expect(stripe.subscriptionItems.createUsageRecord).not.toHaveBeenCalled();
    });
  });

  describe('calculateUsageCharges', () => {
    it('should calculate tiered usage charges correctly', async () => {
      // Mock subscription with usage records
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        plan: { id: 'plan_123', name: 'Pro Plan' },
        usageRecords: [
          {
            featureId: 'feat_1',
            quantity: 100,
            feature: { id: 'feat_1', name: 'API Calls' },
          },
        ],
      } as any);

      // Mock usage tiers
      prismaMock.usageTier.findMany.mockResolvedValue([
        {
          featureId: 'feat_1',
          fromQuantity: 0,
          toQuantity: 50,
          unitPrice: 10, // $0.10 per unit (in cents)
          flatPrice: null,
        },
        {
          featureId: 'feat_1',
          fromQuantity: 50,
          toQuantity: 200,
          unitPrice: 5, // $0.05 per unit (in cents)
          flatPrice: null,
        },
        {
          featureId: 'feat_1',
          fromQuantity: 200,
          toQuantity: null,
          unitPrice: 2, // $0.02 per unit (in cents)
          flatPrice: null,
        },
      ] as any);

      const charge = await calculateUsageCharges('sub_123');

      // First 50 units at $0.10 = $5.00
      // Next 50 units at $0.05 = $2.50
      // Total: $7.50 (750 cents)
      expect(charge).toBe(750);
    });

    it('should handle flat-rate pricing tiers', async () => {
      // Mock subscription with usage records
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub_123',
        plan: { id: 'plan_123', name: 'Pro Plan' },
        usageRecords: [
          {
            featureId: 'feat_1',
            quantity: 120,
            feature: { id: 'feat_1', name: 'Seats' },
          },
        ],
      } as any);

      // Mock usage tiers with flat pricing
      prismaMock.usageTier.findMany.mockResolvedValue([
        {
          featureId: 'feat_1',
          fromQuantity: 0,
          toQuantity: 10,
          unitPrice: null,
          flatPrice: 1000, // $10.00 flat fee (in cents)
        },
        {
          featureId: 'feat_1',
          fromQuantity: 10,
          toQuantity: 50,
          unitPrice: null,
          flatPrice: 2500, // $25.00 flat fee (in cents)
        },
        {
          featureId: 'feat_1',
          fromQuantity: 50,
          toQuantity: 200,
          unitPrice: null,
          flatPrice: 5000, // $50.00 flat fee (in cents)
        },
      ] as any);

      const charge = await calculateUsageCharges('sub_123');

      // Usage is 120, which falls into the third tier
      // Flat fee for third tier: $50.00 (5000 cents)
      expect(charge).toBe(5000);
    });
  });
}); 