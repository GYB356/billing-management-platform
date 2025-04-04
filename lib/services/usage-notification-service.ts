import prisma from '@/lib/prisma';
import { createEvent } from '../events';

interface NotificationThreshold {
  featureId: string;
  featureName: string;
  usage: number;
  limit: number;
  percentUsed: number;
  threshold: number;
}

/**
 * Sends notifications for usage thresholds that have been exceeded
 */
export async function sendUsageNotifications(
  subscriptionId: string,
  thresholds: NotificationThreshold[]
) {
  if (!thresholds.length) {
    return { sent: 0, skipped: 0 };
  }

  // Get subscription details
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: {
        include: {
          userOrganizations: {
            where: {
              role: {
                in: ['OWNER', 'ADMIN']
              }
            },
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const organization = subscription.organization;
  
  // Prepare to track notification status
  let sent = 0;
  let skipped = 0;

  // For each threshold that was exceeded
  for (const threshold of thresholds) {
    try {
      // Check if we've already sent this notification
      const existingNotification = await prisma.usageNotification.findFirst({
        where: {
          subscriptionId,
          featureId: threshold.featureId,
          threshold: threshold.threshold,
          // Only check for notifications in the current billing period
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      });

      if (existingNotification) {
        skipped++;
        continue; // Skip if we've already sent a notification for this threshold
      }

      // Create notification record
      const notificationRecord = await prisma.usageNotification.create({
        data: {
          subscriptionId,
          featureId: threshold.featureId,
          threshold: threshold.threshold,
          usage: threshold.usage,
          limit: threshold.limit,
          percentUsed: threshold.percentUsed
        }
      });

      // Create notification for each admin/owner in the organization
      for (const userOrg of organization.userOrganizations) {
        await prisma.notification.create({
          data: {
            userId: userOrg.user.id,
            organizationId: organization.id,
            title: `Usage Threshold Alert: ${threshold.threshold}%`,
            message: `Your subscription has reached ${threshold.percentUsed.toFixed(1)}% of the limit for feature "${threshold.featureName}".`,
            type: 'WARNING',
            data: {
              subscriptionId,
              featureId: threshold.featureId,
              usage: threshold.usage,
              limit: threshold.limit,
              percentUsed: threshold.percentUsed,
              threshold: threshold.threshold,
              notificationId: notificationRecord.id
            }
          }
        });
      }

      // Create event for threshold notification
      await createEvent({
        eventType: 'USAGE_THRESHOLD_NOTIFICATION',
        resourceType: 'SUBSCRIPTION',
        resourceId: subscriptionId,
        severity: 'WARNING',
        metadata: {
          featureId: threshold.featureId,
          featureName: threshold.featureName,
          usage: threshold.usage,
          limit: threshold.limit,
          percentUsed: threshold.percentUsed,
          threshold: threshold.threshold,
          notificationId: notificationRecord.id
        }
      });

      sent++;
    } catch (error) {
      console.error('Error sending usage notification:', error);
      skipped++;
    }
  }

  return { sent, skipped };
}

/**
 * Checks all active subscriptions for usage thresholds and sends notifications
 */
export async function checkAllSubscriptionsUsage() {
  // Find all active subscriptions
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE'
    },
    select: {
      id: true
    }
  });

  const results = {
    total: activeSubscriptions.length,
    processed: 0,
    notificationsSent: 0,
    errors: 0
  };

  // For each subscription, check usage and notify if thresholds are reached
  for (const subscription of activeSubscriptions) {
    try {
      // Get current billing period
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Check thresholds for the subscription
      const thresholdsExceeded = await checkUsageThresholds(
        subscription.id, 
        startOfMonth, 
        endOfMonth
      );
      
      // Send notifications for any exceeded thresholds
      const notificationResult = await sendUsageNotifications(
        subscription.id, 
        thresholdsExceeded
      );
      
      results.processed++;
      results.notificationsSent += notificationResult.sent;
    } catch (error) {
      console.error(`Error processing subscription ${subscription.id}:`, error);
      results.errors++;
    }
  }

  return results;
}

/**
 * Checks if a subscription has exceeded any usage thresholds
 */
async function checkUsageThresholds(
  subscriptionId: string,
  startDate: Date,
  endDate: Date
) {
  // Check if the subscription exists with its plan and features
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

  if (!subscription || !subscription.plan) {
    throw new Error('Subscription or plan not found');
  }

  const thresholdsExceeded: NotificationThreshold[] = [];

  // For each feature in the plan, check if usage thresholds are exceeded
  for (const planFeature of subscription.plan.planFeatures) {
    // Skip features without limits
    const limitsData = planFeature.limits;
    if (!limitsData) {
      continue;
    }
    
    // Parse the limits data
    const limits = typeof limitsData === 'string' ? JSON.parse(limitsData) : limitsData;
    if (!limits || !limits.maxValue || typeof limits.maxValue !== 'number') {
      continue;
    }

    // Skip if no notification thresholds are defined
    if (!limits.notificationThresholds || !Array.isArray(limits.notificationThresholds) || !limits.notificationThresholds.length) {
      continue;
    }

    const feature = planFeature.feature;
    
    // Get current usage for the feature
    const usageResult = await prisma.usageRecord.aggregate({
      where: {
        subscriptionId,
        featureId: feature.id,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        quantity: true
      }
    });

    const usage = usageResult._sum.quantity || 0;
    const percentUsed = (usage / limits.maxValue) * 100;
    
    // Check each threshold
    for (const threshold of limits.notificationThresholds) {
      if (percentUsed >= threshold) {
        thresholdsExceeded.push({
          featureId: feature.id,
          featureName: feature.name,
          usage,
          limit: limits.maxValue,
          percentUsed,
          threshold
        });
      }
    }
  }

  return thresholdsExceeded;
} 