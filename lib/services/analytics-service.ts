import { prisma } from '../prisma';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { CurrencyService } from '../currency';

interface AdvancedAnalyticsMetrics {
  revenue: {
    mrr: number;
    arr: number;
    netRevenue: number;
    grossRevenue: number;
    growth: {
      percentage: number;
      trend: 'up' | 'down' | 'neutral';
    };
    expansionRevenue: number;
    contractionRevenue: number;
    netRevenueRetention: number;
    grossRevenueRetention: number;
  };
  customers: {
    total: number;
    active: number;
    churnedThisPeriod: number;
    newThisPeriod: number;
    acquisitionCost: number;
    lifetimeValue: number;
    segmentation: Array<{
      segment: string;
      count: number;
      percentage: number;
    }>;
  };
  subscriptions: {
    active: number;
    trialing: number;
    churnRate: number;
    conversionRate: number;
    averageValue: number;
    distribution: {
      byPlan: Array<{
        plan: string;
        count: number;
        percentage: number;
      }>;
      byBillingCycle: Array<{
        cycle: string;
        count: number;
        percentage: number;
      }>;
    };
  };
}

export class AnalyticsService {
  async getAdvancedMetrics(startDate: Date, endDate: Date): Promise<AdvancedAnalyticsMetrics> {
    const [
      revenueMetrics,
      customerMetrics,
      subscriptionMetrics
    ] = await Promise.all([
      this.calculateRevenueMetrics(startDate, endDate),
      this.calculateCustomerMetrics(startDate, endDate),
      this.calculateSubscriptionMetrics(startDate, endDate)
    ]);

    return {
      revenue: revenueMetrics,
      customers: customerMetrics,
      subscriptions: subscriptionMetrics
    };
  }

  private async calculateRevenueMetrics(startDate: Date, endDate: Date) {
    const [currentMRR, previousMRR] = await Promise.all([
      this.calculateMRR(endDate),
      this.calculateMRR(startDate)
    ]);

    const growth = {
      percentage: previousMRR > 0 ? ((currentMRR - previousMRR) / previousMRR) * 100 : 0,
      trend: currentMRR > previousMRR ? 'up' as const : currentMRR < previousMRR ? 'down' as const : 'neutral' as const
    };

    // Calculate expansion and contraction revenue
    const customerRevenue = await prisma.invoice.groupBy({
      by: ['organizationId'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'PAID'
      },
      _sum: {
        totalAmount: true
      }
    });

    const previousPeriodRevenue = await prisma.invoice.groupBy({
      by: ['organizationId'],
      where: {
        createdAt: {
          gte: subMonths(startDate, 1),
          lt: startDate
        },
        status: 'PAID'
      },
      _sum: {
        totalAmount: true
      }
    });

    let expansionRevenue = 0;
    let contractionRevenue = 0;

    customerRevenue.forEach(current => {
      const previous = previousPeriodRevenue.find(p => p.organizationId === current.organizationId);
      if (previous) {
        const difference = (current._sum.totalAmount || 0) - (previous._sum.totalAmount || 0);
        if (difference > 0) {
          expansionRevenue += difference;
        } else {
          contractionRevenue += Math.abs(difference);
        }
      }
    });

    // Calculate retention rates
    const totalRecurringRevenue = await prisma.invoice.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'PAID'
      },
      _sum: {
        totalAmount: true
      }
    });

    const netRevenueRetention = previousMRR > 0 ? (currentMRR / previousMRR) * 100 : 100;
    const grossRevenueRetention = previousMRR > 0 ? 
      ((currentMRR - expansionRevenue) / previousMRR) * 100 : 100;

    return {
      mrr: currentMRR,
      arr: currentMRR * 12,
      netRevenue: totalRecurringRevenue._sum.totalAmount || 0,
      grossRevenue: (totalRecurringRevenue._sum.totalAmount || 0) + (contractionRevenue || 0),
      growth,
      expansionRevenue,
      contractionRevenue,
      netRevenueRetention,
      grossRevenueRetention
    };
  }

  private async calculateCustomerMetrics(startDate: Date, endDate: Date) {
    const [
      totalCustomers,
      activeCustomers,
      churnedCustomers,
      newCustomers,
      marketingCosts
    ] = await Promise.all([
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
          subscriptions: {
            every: {
              status: 'CANCELED',
              canceledAt: {
                gte: startDate,
                lte: endDate
              }
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
      }),
      prisma.expense.aggregate({
        where: {
          category: 'MARKETING',
          createdAt: {
            gte: subMonths(endDate, 12)
          }
        },
        _sum: {
          amount: true
        }
      })
    ]);

    const totalRevenue = await prisma.invoice.aggregate({
      where: {
        status: 'PAID'
      },
      _sum: {
        totalAmount: true
      }
    });

    const acquisitionCost = newCustomers > 0 ? 
      ((marketingCosts._sum.amount || 0) / newCustomers) : 0;

    const lifetimeValue = activeCustomers > 0 ? 
      ((totalRevenue._sum.totalAmount || 0) / activeCustomers) : 0;

    // Calculate customer segmentation
    const customersByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        status: 'ACTIVE'
      },
      _count: true
    });

    const segmentation = await Promise.all(
      customersByPlan.map(async (segment) => {
        const plan = await prisma.pricingPlan.findUnique({
          where: { id: segment.planId }
        });
        return {
          segment: plan?.name || 'Unknown',
          count: segment._count,
          percentage: (segment._count / activeCustomers) * 100
        };
      })
    );

    return {
      total: totalCustomers,
      active: activeCustomers,
      churnedThisPeriod: churnedCustomers,
      newThisPeriod: newCustomers,
      acquisitionCost,
      lifetimeValue,
      segmentation
    };
  }

  private async calculateSubscriptionMetrics(startDate: Date, endDate: Date) {
    const [
      activeSubscriptions,
      trialingSubscriptions,
      endedTrials,
      convertedTrials
    ] = await Promise.all([
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.subscription.count({
        where: { status: 'TRIALING' }
      }),
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          trialEndsAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          trialEndsAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    const totalTrials = endedTrials + convertedTrials;
    const conversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

    // Calculate churn rate
    const startingSubscriptions = await prisma.subscription.count({
      where: {
        createdAt: {
          lt: startDate
        },
        status: {
          in: ['ACTIVE', 'TRIALING']
        }
      }
    });

    const churnedSubscriptions = await prisma.subscription.count({
      where: {
        status: 'CANCELED',
        canceledAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const churnRate = startingSubscriptions > 0 ? 
      (churnedSubscriptions / startingSubscriptions) * 100 : 0;

    // Calculate average subscription value
    const subscriptionRevenue = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE'
      },
      _avg: {
        price: true
      }
    });

    // Get subscription distribution
    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        status: 'ACTIVE'
      },
      _count: true
    });

    const byPlan = await Promise.all(
      subscriptionsByPlan.map(async (plan) => {
        const planDetails = await prisma.pricingPlan.findUnique({
          where: { id: plan.planId }
        });
        return {
          plan: planDetails?.name || 'Unknown',
          count: plan._count,
          percentage: (plan._count / activeSubscriptions) * 100
        };
      })
    );

    const subscriptionsByBillingCycle = await prisma.subscription.groupBy({
      by: ['billingCycle'],
      where: {
        status: 'ACTIVE'
      },
      _count: true
    });

    const byBillingCycle = subscriptionsByBillingCycle.map(cycle => ({
      cycle: cycle.billingCycle,
      count: cycle._count,
      percentage: (cycle._count / activeSubscriptions) * 100
    }));

    return {
      active: activeSubscriptions,
      trialing: trialingSubscriptions,
      churnRate,
      conversionRate,
      averageValue: subscriptionRevenue._avg.price || 0,
      distribution: {
        byPlan,
        byBillingCycle
      }
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
        subscription.plan.price,
        subscription.plan.interval
      );
      return sum + (monthlyPrice * (subscription.quantity || 1));
    }, 0);
  }

  /**
   * Normalize price to monthly basis
   */
  private normalizeToMonthlyPrice(price: number, interval: string): number {
    switch (interval.toLowerCase()) {
      case 'year':
      case 'yearly':
        return price / 12;
      case 'quarter':
      case 'quarterly':
        return price / 3;
      case 'week':
      case 'weekly':
        return price * 4;
      case 'month':
      case 'monthly':
      default:
        return price;
    }
  }
}