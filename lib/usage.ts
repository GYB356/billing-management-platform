import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { Subscription, UsageRecord, PlanFeature, UsageTier } from '@prisma/client';

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

export interface UsageCharges {
  baseCharge: number;
  overageCharge: number;
  totalCharge: number;
}

/**
 * Calculate charges for a given usage quantity based on the feature's pricing model
 */
export function calculateUsageCharges(quantity: number, feature: PlanFeature): number {
  return prisma.usageTier.findMany({
    where: { featureId: feature.id },
    orderBy: { upTo: 'asc' },
  }).then((tiers) => {
    let totalCharge = 0;
    let remainingQuantity = quantity;

    for (const tier of tiers) {
      if (tier.infinite) {
        // For infinite tiers, apply the flat fee and per-unit fee for all remaining quantity
        if (tier.flatFee) totalCharge += tier.flatFee;
        if (tier.perUnitFee) totalCharge += remainingQuantity * tier.perUnitFee;
        break;
      }

      if (remainingQuantity <= 0) break;

      const tierQuantity = Math.min(
        remainingQuantity,
        tier.upTo ? tier.upTo - (tier.previousUpTo || 0) : remainingQuantity
      );

      if (tierQuantity > 0) {
        if (tier.flatFee) totalCharge += tier.flatFee;
        if (tier.perUnitFee) totalCharge += tierQuantity * tier.perUnitFee;
        remainingQuantity -= tierQuantity;
      }
    }

    return totalCharge;
  });
}

/**
 * Get the current tier for a given usage quantity
 */
export async function getCurrentTier(quantity: number, featureId: string): Promise<UsageTier | null> {
  const tiers = await prisma.usageTier.findMany({
    where: { featureId },
    orderBy: { upTo: 'asc' },
  });

  for (const tier of tiers) {
    if (tier.infinite) return tier;
    if (quantity <= (tier.upTo || Infinity)) return tier;
  }

  return null;
}

/**
 * Calculate the remaining quantity until the next tier
 */
export async function getRemainingUntilNextTier(
  quantity: number,
  featureId: string
): Promise<number | null> {
  const currentTier = await getCurrentTier(quantity, featureId);
  if (!currentTier || currentTier.infinite) return null;

  const nextTier = await prisma.usageTier.findFirst({
    where: {
      featureId,
      upTo: {
        gt: currentTier.upTo || 0,
      },
    },
    orderBy: { upTo: 'asc' },
  });

  if (!nextTier) return null;

  return (nextTier.upTo || 0) - quantity;
}

/**
 * Check if usage is approaching or exceeding limits
 */
export async function checkUsageLimits(
  quantity: number,
  featureId: string
): Promise<{
  isExceeded: boolean;
  isWarning: boolean;
  remaining: number | null;
}> {
  const feature = await prisma.planFeature.findUnique({
    where: { id: featureId },
    include: {
      usageTiers: {
        orderBy: { upTo: 'asc' },
      },
    },
  });

  if (!feature) {
    throw new Error('Feature not found');
  }

  const currentTier = await getCurrentTier(quantity, featureId);
  const remaining = await getRemainingUntilNextTier(quantity, featureId);

  // If there's no limit (infinite tier), return false for both flags
  if (!currentTier || currentTier.infinite) {
    return {
      isExceeded: false,
      isWarning: false,
      remaining: null,
    };
  }

  // Calculate percentage of current tier usage
  const tierLimit = currentTier.upTo || 0;
  const usagePercentage = (quantity / tierLimit) * 100;

  return {
    isExceeded: usagePercentage >= 100,
    isWarning: usagePercentage >= 75,
    remaining,
  };
}

/**
 * Record usage for a feature
 */
export async function recordUsage(
  subscriptionId: string,
  featureId: string,
  quantity: number
): Promise<void> {
  // Create usage record
  await prisma.usageRecord.create({
    data: {
      subscriptionId,
      featureId,
      quantity,
    },
  });

  // Check usage limits and send notifications if needed
  const { isExceeded, isWarning, remaining } = await checkUsageLimits(quantity, featureId);

  if (isExceeded || isWarning) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: {
          include: {
            users: {
      where: {
                role: 'ADMIN',
              },
            },
          },
      },
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Send notifications to admin users
    for (const user of subscription.organization.users) {
      await sendUsageNotification(user.email, {
        featureId,
        quantity,
        isExceeded,
        isWarning,
        remaining,
      });
    }
  }
}

/**
 * Send usage notification email
 */
async function sendUsageNotification(
  email: string,
  data: {
    featureId: string;
    quantity: number;
    isExceeded: boolean;
    isWarning: boolean;
    remaining: number | null;
  }
): Promise<void> {
  const feature = await prisma.planFeature.findUnique({
    where: { id: data.featureId },
  });

  if (!feature) {
    throw new Error('Feature not found');
  }

  const subject = data.isExceeded
    ? `Usage Limit Exceeded: ${feature.name}`
    : `Usage Warning: ${feature.name}`;

  const message = data.isExceeded
    ? `You have exceeded the usage limit for ${feature.name}.`
    : `You are approaching the usage limit for ${feature.name}.`;

  // TODO: Implement email sending logic
  console.log(`Sending usage notification to ${email}:`, {
    subject,
    message,
    ...data,
  });
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

interface TrackUsageOptions {
  featureId: string;
  quantity: number;
}

export async function trackUsage({ featureId, quantity }: TrackUsageOptions) {
  try {
    const response = await fetch('/api/subscription/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureId, quantity }),
    });

    if (!response.ok) {
      throw new Error('Failed to track usage');
    }

    return response.json();
  } catch (error) {
    console.error('Error tracking usage:', error);
    // Don't throw the error to prevent disrupting the main flow
    return null;
  }
}

export async function getUsageStats(featureId?: string, startDate?: Date, endDate?: Date) {
  try {
    const params = new URLSearchParams();
    if (featureId) params.append('featureId', featureId);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await fetch(`/api/subscription/usage?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch usage stats');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return null;
  }
}

// Example usage:
// await trackUsage({ featureId: 'api-calls', quantity: 1 });
// const stats = await getUsageStats('api-calls', new Date('2024-01-01'), new Date()); 