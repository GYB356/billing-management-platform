import prisma from '@/lib/prisma';
import { createEvent } from '../events';

export interface RecordUsageParams {
  subscriptionId: string;
  featureId: string;
  quantity: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Records usage for a subscription's feature
 */
export async function recordUsage(params: RecordUsageParams) {
  const { subscriptionId, featureId, quantity, timestamp = new Date(), metadata } = params;

  if (quantity <= 0) {
    throw new Error('Usage quantity must be positive');
  }

  // Check if the subscription exists
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: {
        include: {
          planFeatures: {
            where: { featureId },
            include: { feature: true }
          }
        }
      }
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status !== 'ACTIVE') {
    throw new Error(`Cannot record usage for subscription with status: ${subscription.status}`);
  }

  // Check if the feature exists and is part of the subscription's plan
  if (!subscription.plan || subscription.plan.planFeatures.length === 0) {
    throw new Error('Feature not found in subscription plan');
  }

  // Create usage record
  const usageRecord = await prisma.usageRecord.create({
    data: {
      subscriptionId,
      featureId,
      quantity,
      timestamp,
      metadata,
    }
  });

  // Create event for usage record
  await createEvent({
    eventType: 'USAGE_RECORDED',
    resourceType: 'SUBSCRIPTION',
    resourceId: subscriptionId,
    severity: 'INFO',
    metadata: {
      usageRecordId: usageRecord.id,
      featureId,
      quantity,
      timestamp: timestamp.toISOString(),
    }
  });

  return usageRecord;
}

/**
 * Gets the total usage for a subscription feature within a date range
 */
export async function getFeatureUsage(
  subscriptionId: string, 
  featureId: string, 
  startDate: Date, 
  endDate: Date
) {
  // Check if the subscription exists
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Get the total usage for the feature within the date range
  const result = await prisma.usageRecord.aggregate({
    where: {
      subscriptionId,
      featureId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: {
      quantity: true
    }
  });

  return {
    subscriptionId,
    featureId,
    startDate,
    endDate,
    totalUsage: result._sum.quantity || 0
  };
}

/**
 * Gets usage records for a subscription within a date range
 */
export async function getUsageRecords(
  subscriptionId: string,
  options?: {
    featureId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const { featureId, startDate, endDate, limit = 100, offset = 0 } = options || {};

  // Build the where clause
  const where: any = { subscriptionId };

  if (featureId) {
    where.featureId = featureId;
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      where.timestamp.gte = startDate;
    }
    if (endDate) {
      where.timestamp.lte = endDate;
    }
  }

  // Get the records and count
  const [records, total] = await Promise.all([
    prisma.usageRecord.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        feature: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true
          }
        }
      }
    }),
    prisma.usageRecord.count({ where })
  ]);

  return {
    data: records,
    meta: {
      total,
      limit,
      offset
    }
  };
}

/**
 * Gets aggregated usage for all features of a subscription
 */
export async function getSubscriptionUsageSummary(
  subscriptionId: string,
  startDate: Date,
  endDate: Date
) {
  // Check if the subscription exists
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          }
        }
      }
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (!subscription.plan) {
    throw new Error('Subscription plan not found');
  }

  // Get usage for each feature
  const featureUsages = await Promise.all(
    subscription.plan.planFeatures.map(async (planFeature) => {
      const feature = planFeature.feature;
      const usage = await getFeatureUsage(
        subscriptionId,
        feature.id,
        startDate,
        endDate
      );

      return {
        feature: {
          id: feature.id,
          name: feature.name,
          code: feature.code,
          unit: feature.unit
        },
        usage: usage.totalUsage
      };
    })
  );

  return {
    subscriptionId,
    planId: subscription.planId,
    startDate,
    endDate,
    features: featureUsages
  };
}

/**
 * Checks if a subscription has exceeded usage limits for any features
 */
export async function checkUsageLimits(
  subscriptionId: string,
  startDate: Date,
  endDate: Date
) {
  // Check if the subscription exists with its plan and limits
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          }
        }
      }
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (!subscription.plan) {
    throw new Error('Subscription plan not found');
  }

  // Check usage against limits for each feature
  const featuresExceeded: Array<{
    feature: {
      id: string;
      name: string;
      code: string;
    };
    usage: number;
    limit: number;
    percentUsed: number;
  }> = [];

  for (const planFeature of subscription.plan.planFeatures) {
    // Skip features without limits or if limits is not properly defined
    const limitsData = planFeature.limits;
    if (!limitsData) {
      continue;
    }
    
    // Parse the limits data
    const limits = typeof limitsData === 'string' ? JSON.parse(limitsData) : limitsData;
    if (!limits || !limits.maxValue || typeof limits.maxValue !== 'number') {
      continue;
    }

    const feature = planFeature.feature;
    
    // Get the feature usage for the specified date range
    const usage = await getFeatureUsage(
      subscriptionId,
      feature.id,
      startDate,
      endDate
    );

    // Check against the limit
    if (usage.totalUsage > limits.maxValue) {
      featuresExceeded.push({
        feature: {
          id: feature.id,
          name: feature.name,
          code: feature.code
        },
        usage: usage.totalUsage,
        limit: limits.maxValue,
        percentUsed: (usage.totalUsage / limits.maxValue) * 100
      });
      
      // Create event for limit exceeded
      await createEvent({
        eventType: 'USAGE_LIMIT_EXCEEDED',
        resourceType: 'SUBSCRIPTION',
        resourceId: subscriptionId,
        severity: 'WARNING',
        metadata: {
          featureId: feature.id,
          featureName: feature.name,
          usage: usage.totalUsage,
          limit: limits.maxValue,
          percentUsed: (usage.totalUsage / limits.maxValue) * 100
        }
      });
    }
  }

  return {
    subscriptionId,
    planId: subscription.planId,
    billingPeriod: {
      start: startDate,
      end: endDate
    },
    hasExceededLimits: featuresExceeded.length > 0,
    featuresExceeded
  };
} 