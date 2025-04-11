import { prisma } from '../prisma';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export interface CohortMetrics {
  cohortDate: Date;
  originalCount: number;
  retentionByMonth: {
    month: number;
    count: number;
    percentage: number;
  }[];
}

export interface ChurnAnalysis {
  rate: number;
  count: number;
  reasons: Record<string, number>;
  mrr: number;
  preventableCount: number;
}

export class CohortAnalysisService {
  static async generateCohortAnalysis(months: number = 12): Promise<CohortMetrics[]> {
    const cohorts: CohortMetrics[] = [];
    const startDate = subMonths(new Date(), months);

    // Get all cohorts
    for (let i = 0; i <= months; i++) {
      const cohortDate = startOfMonth(subMonths(new Date(), i));
      const endDate = endOfMonth(cohortDate);

      // Get original cohort members
      const originalMembers = await prisma.subscription.count({
        where: {
          startDate: {
            gte: cohortDate,
            lte: endDate
          }
        }
      });

      if (originalMembers === 0) continue;

      // Calculate retention for each subsequent month
      const retentionByMonth = [];
      for (let j = 1; j <= months - i; j++) {
        const monthDate = endOfMonth(subMonths(new Date(), i - j));
        const activeCount = await prisma.subscription.count({
          where: {
            startDate: {
              gte: cohortDate,
              lte: endDate
            },
            OR: [
              { endDate: null },
              { endDate: { gt: monthDate } }
            ]
          }
        });

        retentionByMonth.push({
          month: j,
          count: activeCount,
          percentage: (activeCount / originalMembers) * 100
        });
      }

      cohorts.push({
        cohortDate,
        originalCount: originalMembers,
        retentionByMonth
      });
    }

    return cohorts;
  }

  static async getChurnAnalysis(period: 'month' | 'quarter' | 'year' = 'month'): Promise<ChurnAnalysis> {
    const startDate = period === 'month' 
      ? subMonths(new Date(), 1)
      : period === 'quarter'
        ? subMonths(new Date(), 3)
        : subMonths(new Date(), 12);

    const [churned, total, churnReasons, mrrLost] = await Promise.all([
      // Get number of churned customers
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          canceledAt: {
            gte: startDate
          }
        }
      }),

      // Get total customers at start of period
      prisma.subscription.count({
        where: {
          startDate: {
            lte: startDate
          }
        }
      }),

      // Get churn reasons
      prisma.subscription.groupBy({
        by: ['cancelReason'],
        where: {
          status: 'CANCELED',
          canceledAt: {
            gte: startDate
          }
        },
        _count: true
      }),

      // Calculate lost MRR
      prisma.subscription.aggregate({
        where: {
          status: 'CANCELED',
          canceledAt: {
            gte: startDate
          }
        },
        _sum: {
          price: true
        }
      })
    ]);

    // Calculate preventable churn (reasons that could be addressed)
    const preventableReasons = ['too_expensive', 'missing_features', 'technical_issues', 'poor_support'];
    const preventableCount = churnReasons
      .filter(r => preventableReasons.includes(r.cancelReason))
      .reduce((sum, r) => sum + r._count, 0);

    return {
      rate: total > 0 ? (churned / total) * 100 : 0,
      count: churned,
      reasons: churnReasons.reduce((acc, r) => ({
        ...acc,
        [r.cancelReason]: r._count
      }), {}),
      mrr: mrrLost._sum.price || 0,
      preventableCount
    };
  }
}