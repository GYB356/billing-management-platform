import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { Subscription, UsageRecord, PlanFeature } from '@prisma/client';

type UsageWithFeature = UsageRecord & {
  feature: PlanFeature;
};

type SubscriptionWithDetails = Subscription & {
  organization: {
    stripeCustomerId: string | null;
  };
  usageRecords: UsageWithFeature[];
};

/**
 * Aggregates usage records for a given subscription and time period
 */
export async function aggregateUsage(
  subscriptionId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  const usageRecords = await prisma.usageRecord.findMany({
    where: {
      subscriptionId,
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      feature: true,
    },
  });

  // Group usage by feature
  return usageRecords.reduce((acc, record) => {
    const featureId = record.featureId;
    if (!acc[featureId]) {
      acc[featureId] = 0;
    }
    acc[featureId] += record.quantity;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Reports usage to Stripe for a specific subscription and feature
 */
export async function reportUsageToStripe(
  subscription: SubscriptionWithDetails,
  featureId: string,
  quantity: number
): Promise<void> {
  // Skip if no Stripe subscription
  if (!subscription.stripeSubscriptionId) {
    console.warn(`Cannot report usage for subscription ${subscription.id} - no Stripe subscription ID`);
    return;
  }

  try {
    // Find the relevant feature
    const feature = subscription.usageRecords.find(record => record.featureId === featureId)?.feature;
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found for subscription ${subscription.id}`);
    }

    // Find the Stripe price ID for this feature (assuming it's stored in metadata)
    const stripePriceId = feature.metadata?.stripePriceId;
    
    if (!stripePriceId) {
      throw new Error(`No Stripe price ID found for feature ${feature.name}`);
    }

    // Report usage to Stripe
    const timestamp = Math.floor(Date.now() / 1000);
    
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      stripePriceId,
      {
        quantity,
        timestamp,
        action: 'increment',
      }
    );

    // Update the usage records to mark them as reported
    await prisma.usageRecord.updateMany({
      where: {
        subscriptionId: subscription.id,
        featureId,
        reportedToStripe: false,
      },
      data: {
        reportedToStripe: true,
        stripeUsageRecordId: usageRecord.id,
      },
    });

    console.log(`Reported usage for subscription ${subscription.id}, feature ${feature.name}: ${quantity} units`);
  } catch (error) {
    console.error(`Error reporting usage to Stripe:`, error);
    throw error;
  }
}

/**
 * Processes pending usage records and reports them to Stripe
 */
export async function processUsageRecords(): Promise<void> {
  // Get all active subscriptions with unreported usage
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      usageRecords: {
        some: {
          reportedToStripe: false,
        },
      },
    },
    include: {
      organization: {
        select: {
          stripeCustomerId: true,
        },
      },
      usageRecords: {
        where: {
          reportedToStripe: false,
        },
        include: {
          feature: true,
        },
      },
    },
  });

  // Process each subscription
  for (const subscription of subscriptions) {
    // Group usage by feature
    const usageByFeature: Record<string, number> = {};
    
    for (const record of subscription.usageRecords) {
      if (!usageByFeature[record.featureId]) {
        usageByFeature[record.featureId] = 0;
      }
      usageByFeature[record.featureId] += record.quantity;
    }

    // Report each feature's usage to Stripe
    for (const [featureId, quantity] of Object.entries(usageByFeature)) {
      await reportUsageToStripe(subscription, featureId, quantity);
    }
  }
}

/**
 * Calculate usage-based charges for a subscription based on current usage
 */
export async function calculateUsageCharges(subscriptionId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      id: subscriptionId,
    },
    include: {
      plan: true,
      usageRecords: {
        where: {
          recordedAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        },
        include: {
          feature: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  let totalCharge = 0;

  // Group usage by feature
  const usageByFeature: Record<string, number> = {};
  for (const record of subscription.usageRecords) {
    if (!usageByFeature[record.featureId]) {
      usageByFeature[record.featureId] = 0;
    }
    usageByFeature[record.featureId] += record.quantity;
  }

  // Calculate charges for each feature
  for (const [featureId, quantity] of Object.entries(usageByFeature)) {
    // Get usage tiers for this feature
    const usageTiers = await prisma.usageTier.findMany({
      where: {
        featureId,
      },
      orderBy: {
        fromQuantity: 'asc',
      },
    });

    // Calculate charge based on tiers
    let remainingQuantity = quantity;
    for (const tier of usageTiers) {
      const tierQuantity = tier.toQuantity 
        ? Math.min(remainingQuantity, tier.toQuantity - tier.fromQuantity) 
        : remainingQuantity;
      
      if (tierQuantity <= 0) break;
      
      // Apply pricing based on tier type
      if (tier.unitPrice) {
        totalCharge += tierQuantity * tier.unitPrice;
      } else if (tier.flatPrice) {
        totalCharge += tier.flatPrice;
      }
      
      remainingQuantity -= tierQuantity;
      if (remainingQuantity <= 0) break;
    }
  }

  return totalCharge;
}

/**
 * Get usage summary for a subscription
 */
export async function getUsageSummary(subscriptionId: string) {
  // Get the subscription with its plan features
  const subscription = await prisma.subscription.findUnique({
    where: {
      id: subscriptionId,
    },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true,
            },
          },
        },
      },
    },
  });

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  // Get all usage metrics
  const features = subscription.plan.planFeatures.map(pf => pf.feature);
  
  // Get current billing period
  const now = new Date();
  const currentPeriodStart = subscription.currentPeriodStart || new Date(now.setMonth(now.getMonth() - 1));
  const currentPeriodEnd = subscription.currentPeriodEnd || new Date();

  // Calculate usage for each feature
  const usageSummary = await Promise.all(
    features.map(async (feature) => {
      // Get usage records for this feature
      const usageRecords = await prisma.usageRecord.findMany({
        where: {
          subscriptionId,
          featureId: feature.id,
          recordedAt: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd,
          },
        },
      });

      // Calculate total usage
      const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);

      // Get usage tiers for this feature
      const usageTiers = await prisma.usageTier.findMany({
        where: {
          featureId: feature.id,
        },
        orderBy: {
          fromQuantity: 'asc',
        },
      });

      // Find current tier
      const currentTier = usageTiers.find(tier => 
        totalUsage >= tier.fromQuantity && 
        (!tier.toQuantity || totalUsage < tier.toQuantity)
      );

      // Calculate progress to next tier
      const nextTier = usageTiers.find(tier => 
        tier.fromQuantity > totalUsage
      );

      const usageLimit = nextTier ? nextTier.fromQuantity : currentTier?.toQuantity || 0;
      const usagePercentage = usageLimit ? (totalUsage / usageLimit) * 100 : 0;

      return {
        feature,
        totalUsage,
        currentTier,
        nextTier,
        usageLimit,
        usagePercentage: Math.min(usagePercentage, 100),
      };
    })
  );

  return {
    subscription,
    usageSummary,
    currentPeriodStart,
    currentPeriodEnd,
  };
} 