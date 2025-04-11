import { prisma } from '@/lib/prisma';
import { notificationService } from './notification-service';

export interface UsageThreshold {
  type: 'percentage' | 'absolute';
  value: number;
  notified?: boolean;
}

export class UsageMonitoringService {
  private static instance: UsageMonitoringService;
  private defaultThresholds: UsageThreshold[] = [
    { type: 'percentage', value: 0.5 },  // 50%
    { type: 'percentage', value: 0.75 }, // 75%
    { type: 'percentage', value: 0.9 },  // 90%
    { type: 'percentage', value: 1.0 },  // 100%
  ];

  private constructor() {}

  public static getInstance(): UsageMonitoringService {
    if (!UsageMonitoringService.instance) {
      UsageMonitoringService.instance = new UsageMonitoringService();
    }
    return UsageMonitoringService.instance;
  }

  async checkUsageThresholds(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: {
            include: {
              features: true,
            },
          },
          usageRecords: {
            where: {
              timestamp: {
                gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
              },
            },
          },
        },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      for (const feature of subscription.plan.features) {
        if (!feature.usageLimit) continue;

        // Calculate current usage
        const featureUsage = subscription.usageRecords
          .filter(record => record.featureId === feature.id)
          .reduce((sum, record) => sum + record.quantity, 0);

        const usagePercentage = featureUsage / feature.usageLimit;

        // Check thresholds and send notifications
        for (const threshold of this.defaultThresholds) {
          const thresholdKey = `${feature.id}-${threshold.value}`;
          const hasNotified = await this.hasThresholdNotificationSent(
            subscriptionId,
            thresholdKey
          );

          if (!hasNotified) {
            const thresholdValue = threshold.type === 'percentage' 
              ? threshold.value 
              : threshold.value / feature.usageLimit;

            if (usagePercentage >= thresholdValue) {
              await this.sendUsageAlert({
                subscriptionId,
                feature,
                currentUsage: featureUsage,
                limit: feature.usageLimit,
                percentage: usagePercentage,
                thresholdKey,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking usage thresholds:', error);
      throw error;
    }
  }

  private async hasThresholdNotificationSent(
    subscriptionId: string,
    thresholdKey: string
  ): Promise<boolean> {
    const record = await prisma.usageNotification.findUnique({
      where: {
        subscriptionId_thresholdKey: {
          subscriptionId,
          thresholdKey,
        },
      },
    });

    return !!record;
  }

  private async sendUsageAlert({
    subscriptionId,
    feature,
    currentUsage,
    limit,
    percentage,
    thresholdKey,
  }: {
    subscriptionId: string;
    feature: any;
    currentUsage: number;
    limit: number;
    percentage: number;
    thresholdKey: string;
  }): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
      },
    });

    if (!subscription?.user) return;

    const percentageFormatted = Math.round(percentage * 100);
    const message = `Your usage of ${feature.name} has reached ${percentageFormatted}% of your limit. Current usage: ${currentUsage} of ${limit} ${feature.unitName || 'units'}.`;

    await notificationService.send({
      userId: subscription.user.id,
      type: 'USAGE',
      title: `Usage Alert: ${feature.name}`,
      message,
      data: {
        featureId: feature.id,
        currentUsage,
        limit,
        percentage,
        actionUrl: '/customer-portal/usage',
      },
      channels: ['email', 'inApp'],
    });

    // Record that we've sent this threshold notification
    await prisma.usageNotification.create({
      data: {
        subscriptionId,
        thresholdKey,
        featureId: feature.id,
        usageAmount: currentUsage,
        percentage,
      },
    });
  }

  async checkAllActiveSubscriptions(): Promise<void> {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { id: true },
    });

    for (const subscription of activeSubscriptions) {
      await this.checkUsageThresholds(subscription.id);
    }
  }
}

export const usageMonitoringService = UsageMonitoringService.getInstance();