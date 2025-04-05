import { prisma } from '@/lib/prisma';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

export interface RevenueSummary {
  totalRevenue: number;
  subscriberRevenue: number;
  oneTimeRevenue: number;
  recurringRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  growth: {
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  };
}

export interface SubscriptionSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  pausedSubscriptions: number;
  averageSubscriptionValue: number;
  churnRate: number;
  growth: {
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  };
}

export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  newCustomers: number;
  customerLifetimeValue: number;
  growth: {
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  };
}

export interface UsageSummary {
  totalUsage: number;
  usageByFeature: Record<string, number>;
  overageCharges: number;
  utilizationRate: number;
}

export class AnalyticsService {
  /**
   * Get revenue metrics for a period
   */
  public async getRevenueSummary(period: AnalyticsPeriod): Promise<RevenueSummary> {
    const { startDate, endDate } = period;

    // Get all successful payments in the period
    const payments = await prisma.payment.findMany({
      where: {
        status: {
          in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED]
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        refunds: true,
        subscription: true
      }
    });

    let totalRevenue = 0;
    let subscriberRevenue = 0;
    let oneTimeRevenue = 0;
    let refundedAmount = 0;

    for (const payment of payments) {
      const paymentAmount = payment.amount;
      totalRevenue += paymentAmount;

      if (payment.subscription) {
        subscriberRevenue += paymentAmount;
      } else {
        oneTimeRevenue += paymentAmount;
      }

      // Calculate refunds
      const refunds = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      refundedAmount += refunds;
    }

    // Calculate recurring revenue (MRR)
    const recurringRevenue = await this.calculateMRR(endDate);

    // Calculate growth
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
    const previousPeriodEnd = new Date(endDate);
    previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() - 1);

    const previousRevenue = await this.calculateTotalRevenue({
      startDate: previousPeriodStart,
      endDate: previousPeriodEnd
    });

    const growth = this.calculateGrowth(totalRevenue, previousRevenue);

    return {
      totalRevenue,
      subscriberRevenue,
      oneTimeRevenue,
      recurringRevenue,
      refundedAmount,
      netRevenue: totalRevenue - refundedAmount,
      growth
    };
  }

  /**
   * Get subscription metrics
   */
  public async getSubscriptionSummary(period: AnalyticsPeriod): Promise<SubscriptionSummary> {
    const { startDate, endDate } = period;

    // Get subscription counts
    const [
      totalSubscriptions,
      activeSubscriptions,
      canceledSubscriptions,
      pausedSubscriptions
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.subscription.count({
        where: {
          canceledAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.subscription.count({
        where: { status: 'PAUSED' }
      })
    ]);

    // Calculate average subscription value
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        plan: true
      }
    });

    const totalValue = subscriptions.reduce((sum, sub) => sum + sub.plan.basePrice, 0);
    const averageSubscriptionValue = totalValue / (subscriptions.length || 1);

    // Calculate churn rate
    const startingCustomers = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: {
          lt: startDate
        }
      }
    });

    const churnedCustomers = await prisma.subscription.count({
      where: {
        status: 'CANCELLED',
        canceledAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const churnRate = (churnedCustomers / (startingCustomers || 1)) * 100;

    // Calculate growth
    const previousActiveCount = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: {
          lt: startDate
        }
      }
    });

    const growth = this.calculateGrowth(activeSubscriptions, previousActiveCount);

    return {
      totalSubscriptions,
      activeSubscriptions,
      canceledSubscriptions,
      pausedSubscriptions,
      averageSubscriptionValue,
      churnRate,
      growth
    };
  }

  /**
   * Get customer metrics
   */
  public async getCustomerSummary(period: AnalyticsPeriod): Promise<CustomerSummary> {
    const { startDate, endDate } = period;

    // Get customer counts
    const [totalCustomers, activeCustomers, newCustomers] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({
        where: {
          subscriptions: {
            some: {
              status: 'ACTIVE'
            }
          }
        }
      }),
      prisma.organization.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    const inactiveCustomers = totalCustomers - activeCustomers;

    // Calculate customer lifetime value
    const allPayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED
      },
      include: {
        refunds: true
      }
    });

    const netRevenue = allPayments.reduce((sum, payment) => {
      const refunds = payment.refunds.reduce((r, refund) => r + refund.amount, 0);
      return sum + (payment.amount - refunds);
    }, 0);

    const customerLifetimeValue = netRevenue / (totalCustomers || 1);

    // Calculate growth
    const previousActiveCount = await prisma.organization.count({
      where: {
        subscriptions: {
          some: {
            status: 'ACTIVE',
            createdAt: {
              lt: startDate
            }
          }
        }
      }
    });

    const growth = this.calculateGrowth(activeCustomers, previousActiveCount);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      newCustomers,
      customerLifetimeValue,
      growth
    };
  }

  /**
   * Get usage metrics
   */
  public async getUsageSummary(period: AnalyticsPeriod): Promise<UsageSummary> {
    const { startDate, endDate } = period;

    // Get all usage records
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        recordedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        feature: true
      }
    });

    // Calculate total usage and usage by feature
    const usageByFeature: Record<string, number> = {};
    let totalUsage = 0;

    for (const record of usageRecords) {
      const featureName = record.feature.name;
      if (!usageByFeature[featureName]) {
        usageByFeature[featureName] = 0;
      }
      usageByFeature[featureName] += record.quantity;
      totalUsage += record.quantity;
    }

    // Calculate overage charges
    const overageCharges = await this.calculateOverageCharges(period);

    // Calculate utilization rate
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        plan: {
          include: {
            planFeatures: true
          }
        }
      }
    });

    let totalUtilization = 0;
    let featureCount = 0;

    for (const subscription of subscriptions) {
      for (const planFeature of subscription.plan.planFeatures) {
        const usage = usageByFeature[planFeature.feature.name] || 0;
        const limit = planFeature.usageLimit || 1;
        totalUtilization += (usage / limit) * 100;
        featureCount++;
      }
    }

    const utilizationRate = totalUtilization / (featureCount || 1);

    return {
      totalUsage,
      usageByFeature,
      overageCharges,
      utilizationRate
    };
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR)
   */
  private async calculateMRR(date: Date): Promise<number> {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: date
        }
      },
      include: {
        plan: true
      }
    });

    return activeSubscriptions.reduce((sum, subscription) => {
      const monthlyPrice = this.normalizeToMonthlyPrice(
        subscription.plan.basePrice,
        subscription.plan.billingInterval
      );
      return sum + (monthlyPrice * (subscription.quantity || 1));
    }, 0);
  }

  /**
   * Calculate total revenue for a period
   */
  private async calculateTotalRevenue(period: AnalyticsPeriod): Promise<number> {
    const payments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate
        }
      },
      include: {
        refunds: true
      }
    });

    return payments.reduce((sum, payment) => {
      const refunds = payment.refunds.reduce((r, refund) => r + refund.amount, 0);
      return sum + (payment.amount - refunds);
    }, 0);
  }

  /**
   * Calculate overage charges for a period
   */
  private async calculateOverageCharges(period: AnalyticsPeriod): Promise<number> {
    const overagePayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate
        },
        metadata: {
          path: ['type'],
          equals: 'overage'
        }
      }
    });

    return overagePayments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  /**
   * Calculate growth percentage and trend
   */
  private calculateGrowth(current: number, previous: number): {
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  } {
    if (previous === 0) {
      return {
        percentage: current > 0 ? 100 : 0,
        trend: current > 0 ? 'up' : 'neutral'
      };
    }

    const percentage = ((current - previous) / previous) * 100;
    return {
      percentage: Math.abs(percentage),
      trend: percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'neutral'
    };
  }

  /**
   * Normalize price to monthly basis
   */
  private normalizeToMonthlyPrice(price: number, interval: string): number {
    switch (interval) {
      case 'yearly':
        return price / 12;
      case 'quarterly':
        return price / 3;
      case 'weekly':
        return price * 4;
      default:
        return price;
    }
  }
}