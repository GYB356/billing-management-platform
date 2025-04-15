import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';
import { TransactionManager } from '../utils/TransactionManager';

interface RevenueMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  revenueGrowth: number;
  averageRevenuePerUser: number;
}

interface ChurnMetrics {
  churnRate: number;
  retentionRate: number;
  churningMRR: number;
  churnedSubscriptions: number;
  totalChurned: number;
}

interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  canceledSubscriptions: number;
  conversionRate: number;
}

export class AnalyticsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getRevenueMetrics(startDate: Date, endDate: Date): Promise<RevenueMetrics> {
    try {
      const [currentPeriod, previousPeriod] = await Promise.all([
        this.calculateRevenue(startDate, endDate),
        this.calculateRevenue(
          new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
          startDate
        )
      ]);

      const revenueGrowth = previousPeriod.total > 0 
        ? ((currentPeriod.total - previousPeriod.total) / previousPeriod.total) * 100 
        : 100;

      const activeUsers = await this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: { gte: new Date() }
        }
      });

      return {
        mrr: currentPeriod.mrr,
        arr: currentPeriod.mrr * 12,
        totalRevenue: currentPeriod.total,
        revenueGrowth,
        averageRevenuePerUser: activeUsers > 0 ? currentPeriod.mrr / activeUsers : 0
      };
    } catch (error) {
      Logger.error('Error calculating revenue metrics', { error });
      throw error;
    }
  }

  async getChurnMetrics(startDate: Date, endDate: Date): Promise<ChurnMetrics> {
    try {
      const [churned, total] = await Promise.all([
        // Get churned subscriptions
        this.prisma.subscription.count({
          where: {
            status: 'CANCELED',
            cancelledAt: {
              gte: startDate,
              lt: endDate
            }
          }
        }),
        // Get total active subscriptions at start
        this.prisma.subscription.count({
          where: {
            status: 'ACTIVE',
            currentPeriodStart: { lt: startDate }
          }
        })
      ]);

      const churnRate = total > 0 ? (churned / total) * 100 : 0;

      // Calculate churning MRR
      const churningSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'CANCELED',
          cancelledAt: {
            gte: startDate,
            lt: endDate
          }
        },
        include: {
          plan: true
        }
      });

      const churningMRR = churningSubscriptions.reduce(
        (total, sub) => total + sub.plan.currentPrice,
        0
      );

      return {
        churnRate,
        retentionRate: 100 - churnRate,
        churningMRR,
        churnedSubscriptions: churned,
        totalChurned: churned
      };
    } catch (error) {
      Logger.error('Error calculating churn metrics', { error });
      throw error;
    }
  }

  async getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
    try {
      const [active, trial, canceled, total] = await Promise.all([
        this.prisma.subscription.count({
          where: { status: 'ACTIVE' }
        }),
        this.prisma.subscription.count({
          where: { status: 'TRIALING' }
        }),
        this.prisma.subscription.count({
          where: { status: 'CANCELED' }
        }),
        this.prisma.subscription.count()
      ]);

      // Calculate trial conversion rate
      const convertedTrials = await this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          trialEndsAt: { not: null }
        }
      });

      const totalCompletedTrials = convertedTrials + await this.prisma.subscription.count({
        where: {
          status: 'CANCELED',
          trialEndsAt: { not: null }
        }
      });

      const conversionRate = totalCompletedTrials > 0 
        ? (convertedTrials / totalCompletedTrials) * 100 
        : 0;

      return {
        totalSubscriptions: total,
        activeSubscriptions: active,
        trialSubscriptions: trial,
        canceledSubscriptions: canceled,
        conversionRate
      };
    } catch (error) {
      Logger.error('Error calculating subscription metrics', { error });
      throw error;
    }
  }

  async generateRevenueReport(startDate: Date, endDate: Date) {
    return TransactionManager.executeInTransaction(async (prisma) => {
      const [revenue, churn, subscriptions] = await Promise.all([
        this.getRevenueMetrics(startDate, endDate),
        this.getChurnMetrics(startDate, endDate),
        this.getSubscriptionMetrics()
      ]);

      // Create report
      const report = await prisma.report.create({
        data: {
          type: 'REVENUE',
          format: 'JSON',
          status: 'COMPLETED',
          createdBy: 'SYSTEM',
          metadata: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            revenue,
            churn,
            subscriptions
          }
        }
      });

      Logger.info('Revenue report generated', { reportId: report.id });
      return report;
    });
  }

  private async calculateRevenue(startDate: Date, endDate: Date) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'succeeded',
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        subscription: true
      }
    });

    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Calculate MRR from recurring payments only
    const recurringPayments = payments.filter(p => p.subscription);
    const mrr = recurringPayments.reduce((sum, payment) => sum + payment.amount, 0) / 
      ((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)); // Normalize to monthly

    return { total, mrr };
  }
} 