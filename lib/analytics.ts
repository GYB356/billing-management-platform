import { prisma } from './prisma';
import { stripe } from './stripe';
import { CurrencyService } from './currency';

export interface AnalyticsMetrics {
  revenue: {
    mrr: number;
    arr: number;
    growth: number;
    byPlan: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    canceled: number;
    churnRate: number;
    conversionRate: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };
  customers: {
    total: number;
    newThisMonth: number;
    active: number;
    churned: number;
    lifetimeValue: number;
    byCountry: Record<string, number>;
  };
  usage: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    byEndpoint: Record<string, number>;
  };
}

export class AnalyticsService {
  static async getMetrics(): Promise<AnalyticsMetrics> {
    const [
      subscriptions,
      customers,
      revenue,
      usage,
    ] = await Promise.all([
      this.getSubscriptionMetrics(),
      this.getCustomerMetrics(),
      this.getRevenueMetrics(),
      this.getUsageMetrics(),
    ]);

    return {
      revenue,
      subscriptions,
      customers,
      usage,
    };
  }

  private static async getSubscriptionMetrics() {
    const [
      total,
      active,
      trialing,
      canceled,
      byPlan,
      byStatus,
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIALING' } }),
      prisma.subscription.count({ where: { status: 'CANCELED' } }),
      prisma.subscription.groupBy({
        by: ['planId'],
        _count: true,
      }),
      prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const churnRate = total > 0 ? (canceled / total) * 100 : 0;
    const conversionRate = total > 0 ? ((active + trialing) / total) * 100 : 0;

    return {
      total,
      active,
      trialing,
      canceled,
      churnRate,
      conversionRate,
      byPlan: byPlan.reduce((acc, curr) => ({
        ...acc,
        [curr.planId]: curr._count,
      }), {}),
      byStatus: byStatus.reduce((acc, curr) => ({
        ...acc,
        [curr.status]: curr._count,
      }), {}),
    };
  }

  private static async getCustomerMetrics() {
    const [
      total,
      newThisMonth,
      active,
      churned,
      byCountry,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        },
      }),
      prisma.organization.count({
        where: {
          subscriptions: {
            some: {
              status: 'ACTIVE',
            },
          },
        },
      }),
      prisma.organization.count({
        where: {
          subscriptions: {
            every: {
              status: 'CANCELED',
            },
          },
        },
      }),
      prisma.organization.groupBy({
        by: ['country'],
        _count: true,
      }),
    ]);

    // Calculate average lifetime value
    const totalRevenue = await prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    const lifetimeValue = total > 0
      ? (totalRevenue._sum.totalAmount || 0) / total
      : 0;

    return {
      total,
      newThisMonth,
      active,
      churned,
      lifetimeValue,
      byCountry: byCountry.reduce((acc, curr) => ({
        ...acc,
        [curr.country || 'Unknown']: curr._count,
      }), {}),
    };
  }

  private static async getRevenueMetrics() {
    const [
      currentMonthRevenue,
      lastMonthRevenue,
      byPlan,
      byCurrency,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setDate(1)),
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            lt: new Date(new Date().setDate(1)),
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.invoice.groupBy({
        by: ['subscription.planId'],
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.invoice.groupBy({
        by: ['currency'],
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const mrr = currentMonthRevenue._sum.totalAmount || 0;
    const arr = mrr * 12;
    const growth = lastMonthRevenue._sum.totalAmount
      ? ((mrr - lastMonthRevenue._sum.totalAmount) / lastMonthRevenue._sum.totalAmount) * 100
      : 0;

    return {
      mrr,
      arr,
      growth,
      byPlan: byPlan.reduce((acc, curr) => ({
        ...acc,
        [curr.planId]: curr._sum.totalAmount || 0,
      }), {}),
      byCurrency: byCurrency.reduce((acc, curr) => ({
        ...acc,
        [curr.currency]: curr._sum.totalAmount || 0,
      }), {}),
    };
  }

  private static async getUsageMetrics() {
    const [
      totalRequests,
      averageResponseTime,
      errorCount,
      byEndpoint,
    ] = await Promise.all([
      prisma.event.count({
        where: {
          eventType: 'API_REQUEST',
        },
      }),
      prisma.event.aggregate({
        where: {
          eventType: 'API_REQUEST',
        },
        _avg: {
          metadata: {
            path: 'duration',
          },
        },
      }),
      prisma.event.count({
        where: {
          eventType: 'API_ERROR',
        },
      }),
      prisma.event.groupBy({
        by: ['metadata.endpoint'],
        where: {
          eventType: 'API_REQUEST',
        },
        _count: true,
      }),
    ]);

    const errorRate = totalRequests > 0
      ? (errorCount / totalRequests) * 100
      : 0;

    return {
      totalRequests,
      averageResponseTime: averageResponseTime._avg.metadata?.duration || 0,
      errorRate,
      byEndpoint: byEndpoint.reduce((acc, curr) => ({
        ...acc,
        [curr.metadata.endpoint as string]: curr._count,
      }), {}),
    };
  }
} 