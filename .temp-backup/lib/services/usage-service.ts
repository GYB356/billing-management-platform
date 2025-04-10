import { prisma } from '@/lib/prisma';
import { MeteringType, UsageStatus, AggregationType } from '@prisma/client';
import { createEvent } from '../events';

interface UsageEvent {
  subscriptionId: string;
  metricId: string;
  value: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

interface MeteringConfig {
  type: MeteringType;
  aggregation: AggregationType;
  resetInterval?: 'hourly' | 'daily' | 'monthly' | 'yearly';
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

export class UsageService {
  /**
   * Track a usage event
   */
  public async trackUsage(event: UsageEvent) {
    const { subscriptionId, metricId, value, timestamp = new Date(), metadata = {} } = event;

    // Get metric configuration
    const metric = await prisma.usageMetric.findUnique({
      where: { id: metricId },
      include: {
        meteringConfig: true
      }
    });

    if (!metric) {
      throw new Error('Usage metric not found');
    }

    // Get subscription and plan
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            usageLimits: {
              where: { metricId }
            }
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Record usage event
    const usageEvent = await prisma.usageEvent.create({
      data: {
        subscriptionId,
        metricId,
        value,
        timestamp,
        metadata
      }
    });

    // Update aggregated usage
    await this.updateAggregatedUsage(
      subscriptionId,
      metricId,
      metric.meteringConfig,
      timestamp
    );

    // Check usage limits
    await this.checkUsageLimits(subscription, metric, timestamp);

    // Create event
    await createEvent({
      type: 'USAGE_TRACKED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscriptionId,
      metadata: {
        metricId,
        value,
        timestamp
      }
    });

    return usageEvent;
  }

  /**
   * Update aggregated usage based on metering configuration
   */
  private async updateAggregatedUsage(
    subscriptionId: string,
    metricId: string,
    meteringConfig: MeteringConfig,
    timestamp: Date
  ) {
    const { type, aggregation, resetInterval } = meteringConfig;

    // Get time range for aggregation
    const timeRange = this.getTimeRange(timestamp, resetInterval);

    // Get usage events in time range
    const events = await prisma.usageEvent.findMany({
      where: {
        subscriptionId,
        metricId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }
    });

    // Calculate aggregated value
    let aggregatedValue: number;
    switch (aggregation) {
      case 'SUM':
        aggregatedValue = events.reduce((sum, event) => sum + event.value, 0);
        break;
      case 'MAX':
        aggregatedValue = Math.max(...events.map(event => event.value));
        break;
      case 'MIN':
        aggregatedValue = Math.min(...events.map(event => event.value));
        break;
      case 'AVG':
        aggregatedValue = events.reduce((sum, event) => sum + event.value, 0) / events.length;
        break;
      case 'LAST':
        aggregatedValue = events[events.length - 1]?.value || 0;
        break;
      default:
        throw new Error(`Unsupported aggregation type: ${aggregation}`);
    }

    // Update or create aggregated usage record
    await prisma.aggregatedUsage.upsert({
      where: {
        subscriptionId_metricId_period: {
          subscriptionId,
          metricId,
          period: timeRange.start.toISOString()
        }
      },
      update: {
        value: aggregatedValue,
        lastUpdated: timestamp
      },
      create: {
        subscriptionId,
        metricId,
        period: timeRange.start.toISOString(),
        value: aggregatedValue,
        lastUpdated: timestamp
      }
    });
  }

  /**
   * Check usage against limits and trigger notifications
   */
  private async checkUsageLimits(
    subscription: any,
    metric: any,
    timestamp: Date
  ) {
    const usageLimit = subscription.plan.usageLimits[0];
    if (!usageLimit) {
      return; // No limits defined
    }

    // Get current period usage
    const timeRange = this.getTimeRange(timestamp, metric.meteringConfig.resetInterval);
    const currentUsage = await prisma.aggregatedUsage.findFirst({
      where: {
        subscriptionId: subscription.id,
        metricId: metric.id,
        period: timeRange.start.toISOString()
      }
    });

    if (!currentUsage) {
      return;
    }

    const usagePercentage = (currentUsage.value / usageLimit.limit) * 100;

    // Check thresholds
    if (metric.meteringConfig.thresholds) {
      const { warning, critical } = metric.meteringConfig.thresholds;

      if (critical && usagePercentage >= critical) {
        await this.handleCriticalUsage(subscription, metric, currentUsage);
      } else if (warning && usagePercentage >= warning) {
        await this.handleWarningUsage(subscription, metric, currentUsage);
      }
    }

    // Check if usage exceeds limit
    if (usageLimit.limit && currentUsage.value > usageLimit.limit) {
      await this.handleExceededUsage(subscription, metric, currentUsage);
    }
  }

  /**
   * Handle warning level usage
   */
  private async handleWarningUsage(
    subscription: any,
    metric: any,
    usage: any
  ) {
    // Create notification
    await prisma.notification.create({
      data: {
        type: 'USAGE_WARNING',
        title: 'Usage Warning',
        message: `Usage for ${metric.name} has reached warning threshold`,
        userId: subscription.organizationId,
        data: {
          subscriptionId: subscription.id,
          metricId: metric.id,
          currentUsage: usage.value,
          limit: subscription.plan.usageLimits[0].limit
        },
        priority: 'medium'
      }
    });

    // Create event
    await createEvent({
      type: 'USAGE_WARNING',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      severity: 'WARNING',
      metadata: {
        metricId: metric.id,
        currentUsage: usage.value,
        limit: subscription.plan.usageLimits[0].limit
      }
    });
  }

  /**
   * Handle critical level usage
   */
  private async handleCriticalUsage(
    subscription: any,
    metric: any,
    usage: any
  ) {
    // Create notification
    await prisma.notification.create({
      data: {
        type: 'USAGE_CRITICAL',
        title: 'Critical Usage Alert',
        message: `Usage for ${metric.name} has reached critical threshold`,
        userId: subscription.organizationId,
        data: {
          subscriptionId: subscription.id,
          metricId: metric.id,
          currentUsage: usage.value,
          limit: subscription.plan.usageLimits[0].limit
        },
        priority: 'high'
      }
    });

    // Create event
    await createEvent({
      type: 'USAGE_CRITICAL',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      severity: 'HIGH',
      metadata: {
        metricId: metric.id,
        currentUsage: usage.value,
        limit: subscription.plan.usageLimits[0].limit
      }
    });
  }

  /**
   * Handle exceeded usage
   */
  private async handleExceededUsage(
    subscription: any,
    metric: any,
    usage: any
  ) {
    // Update usage status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        usageStatus: UsageStatus.EXCEEDED
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'USAGE_EXCEEDED',
        title: 'Usage Limit Exceeded',
        message: `Usage limit for ${metric.name} has been exceeded`,
        userId: subscription.organizationId,
        data: {
          subscriptionId: subscription.id,
          metricId: metric.id,
          currentUsage: usage.value,
          limit: subscription.plan.usageLimits[0].limit
        },
        priority: 'high'
      }
    });

    // Create event
    await createEvent({
      type: 'USAGE_EXCEEDED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      severity: 'HIGH',
      metadata: {
        metricId: metric.id,
        currentUsage: usage.value,
        limit: subscription.plan.usageLimits[0].limit
      }
    });
  }

  /**
   * Get usage statistics
   */
  public async getUsageStats(
    subscriptionId: string,
    metricId: string,
    startDate: Date,
    endDate: Date
  ) {
    const usage = await prisma.usageEvent.findMany({
      where: {
        subscriptionId,
        metricId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    const aggregatedUsage = await prisma.aggregatedUsage.findMany({
      where: {
        subscriptionId,
        metricId,
        period: {
          gte: startDate.toISOString(),
          lte: endDate.toISOString()
        }
      },
      orderBy: {
        period: 'asc'
      }
    });

    return {
      rawUsage: usage,
      aggregatedUsage,
      total: usage.reduce((sum, event) => sum + event.value, 0),
      average: usage.length > 0
        ? usage.reduce((sum, event) => sum + event.value, 0) / usage.length
        : 0,
      max: usage.length > 0
        ? Math.max(...usage.map(event => event.value))
        : 0,
      min: usage.length > 0
        ? Math.min(...usage.map(event => event.value))
        : 0
    };
  }

  /**
   * Calculate billable usage
   */
  public async calculateBillableUsage(
    subscriptionId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date
  ) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            usagePricing: {
              include: {
                metric: true,
                tiers: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const billableUsage = [];

    for (const pricing of subscription.plan.usagePricing) {
      // Get aggregated usage for the metric
      const usage = await prisma.aggregatedUsage.findMany({
        where: {
          subscriptionId,
          metricId: pricing.metric.id,
          period: {
            gte: billingPeriodStart.toISOString(),
            lte: billingPeriodEnd.toISOString()
          }
        }
      });

      // Calculate total usage
      const totalUsage = usage.reduce((sum, record) => sum + record.value, 0);

      // Calculate cost based on pricing tiers
      let cost = 0;
      let remainingUsage = totalUsage;

      // Sort tiers by start amount
      const sortedTiers = pricing.tiers.sort((a, b) => a.startAmount - b.startAmount);

      for (const tier of sortedTiers) {
        if (remainingUsage <= 0) break;

        const tierUsage = Math.min(
          remainingUsage,
          tier.endAmount ? tier.endAmount - tier.startAmount : remainingUsage
        );

        cost += tierUsage * tier.unitPrice;
        remainingUsage -= tierUsage;
      }

      billableUsage.push({
        metricId: pricing.metric.id,
        metricName: pricing.metric.name,
        totalUsage,
        cost,
        usage
      });
    }

    return billableUsage;
  }

  /**
   * Get time range based on reset interval
   */
  private getTimeRange(date: Date, interval?: string) {
    const start = new Date(date);
    const end = new Date(date);

    switch (interval) {
      case 'hourly':
        start.setMinutes(0, 0, 0);
        end.setMinutes(59, 59, 999);
        break;
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yearly':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        // If no interval, use all time
        start.setFullYear(1970);
        end.setFullYear(9999);
    }

    return { start, end };
  }
}