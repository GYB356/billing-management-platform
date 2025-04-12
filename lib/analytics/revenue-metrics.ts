import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import logger from '@/lib/logger';
import { SubscriptionStatus } from '@prisma/client';

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  ltv: number;
  cac: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

export interface ChartData {
  date: string;
  value: number;
}

export const getRevenueMetrics = cache(async (): Promise<RevenueMetrics> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Calculate MRR from active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        plan: true,
      },
    });

    const mrr = subscriptions.reduce((total, sub) => total + (sub.plan?.price || 0), 0);
    const arr = mrr * 12;

    // Calculate churn rate
    const cancelledSubscriptions = await prisma.subscription.count({
      where: {
        status: SubscriptionStatus.CANCELED,
        updatedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const churnRate = activeSubscriptions > 0 
      ? (cancelledSubscriptions / activeSubscriptions) * 100 
      : 0;

    // Calculate LTV (Lifetime Value)
    const averageSubscriptionDuration = 12; // months, can be calculated from historical data
    const ltv = activeSubscriptions > 0 
      ? (mrr / activeSubscriptions) * averageSubscriptionDuration 
      : 0;

    // Calculate CAC (Customer Acquisition Cost)
    const totalMarketingSpend = await prisma.marketingExpense.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        date: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const newCustomers = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const cac = newCustomers > 0 
      ? (totalMarketingSpend._sum.amount || 0) / newCustomers 
      : 0;

    // Calculate total revenue
    const totalRevenue = await prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'SUCCEEDED',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    return {
      mrr,
      arr,
      churnRate,
      ltv,
      cac,
      activeSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
    };
  } catch (error) {
    logger.error('Failed to calculate revenue metrics', error as Error);
    throw error;
  }
});

export const getRevenueChartData = cache(async (metric: keyof RevenueMetrics, days: number = 30): Promise<ChartData[]> => {
  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Get daily metrics
    const dailyData = await prisma.payment.groupBy({
      by: ['createdAt'],
      _sum: {
        amount: true,
      },
      where: {
        status: 'SUCCEEDED',
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Format data for chart
    return dailyData.map(day => ({
      date: day.createdAt.toISOString().split('T')[0],
      value: day._sum.amount || 0,
    }));
  } catch (error) {
    logger.error('Failed to get revenue chart data', error as Error);
    throw error;
  }
}); 