import { prisma } from '../prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

export interface UsageMetrics {
  totalUsage: number;
  usageByPeriod: Array<{ date: string; usage: number }>;
  usageByResource: Array<{ resource: string; usage: number }>;
  costByResource: Array<{ resource: string; cost: number }>;
  projectedUsage: number;
  trendPercentage: number;
}

export class UsageAnalyticsService {
  async getUsageMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<UsageMetrics> {
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscription: {
          organizationId,
        },
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);

    // Calculate usage by period (daily)
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const usageByPeriod = days.map(day => {
      const dayUsage = usageRecords
        .filter(record => format(record.timestamp, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
        .reduce((sum, record) => sum + record.quantity, 0);
      
      return {
        date: format(day, 'yyyy-MM-dd'),
        usage: dayUsage,
      };
    });

    // Calculate usage by resource type
    const usageByResource = Object.entries(
      usageRecords.reduce((acc, record) => {
        const resourceType = record.subscription.plan.usageType;
        acc[resourceType] = (acc[resourceType] || 0) + record.quantity;
        return acc;
      }, {} as Record<string, number>)
    ).map(([resource, usage]) => ({ resource, usage }));

    // Calculate cost by resource
    const costByResource = Object.entries(
      usageRecords.reduce((acc, record) => {
        const resourceType = record.subscription.plan.usageType;
        const cost = record.quantity * (record.subscription.plan.unitPrice || 0);
        acc[resourceType] = (acc[resourceType] || 0) + cost;
        return acc;
      }, {} as Record<string, number>)
    ).map(([resource, cost]) => ({ resource, cost }));

    // Calculate projected usage based on current trend
    const projectedUsage = this.calculateProjectedUsage(usageByPeriod);

    // Calculate trend percentage
    const trendPercentage = this.calculateTrendPercentage(usageByPeriod);

    return {
      totalUsage,
      usageByPeriod,
      usageByResource,
      costByResource,
      projectedUsage,
      trendPercentage,
    };
  }

  private calculateProjectedUsage(usageByPeriod: Array<{ date: string; usage: number }>): number {
    if (usageByPeriod.length < 2) return 0;

    const recentUsage = usageByPeriod.slice(-7); // Last 7 days
    const avgDailyUsage = recentUsage.reduce((sum, day) => sum + day.usage, 0) / recentUsage.length;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    return avgDailyUsage * daysInMonth;
  }

  private calculateTrendPercentage(usageByPeriod: Array<{ date: string; usage: number }>): number {
    if (usageByPeriod.length < 14) return 0;

    const previousWeek = usageByPeriod.slice(-14, -7);
    const currentWeek = usageByPeriod.slice(-7);

    const previousAvg = previousWeek.reduce((sum, day) => sum + day.usage, 0) / previousWeek.length;
    const currentAvg = currentWeek.reduce((sum, day) => sum + day.usage, 0) / currentWeek.length;

    if (previousAvg === 0) return 0;
    return ((currentAvg - previousAvg) / previousAvg) * 100;
  }

  async getResourceUtilization(organizationId: string): Promise<Array<{ resource: string; utilized: number; limit: number }>> {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
        usageRecords: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 1,
        },
      },
    });

    return subscriptions.map(subscription => ({
      resource: subscription.plan.usageType,
      utilized: subscription.usageRecords[0]?.quantity || 0,
      limit: subscription.plan.usageLimit || 0,
    }));
  }

  async generateUsageReport(organizationId: string, startDate: Date, endDate: Date) {
    const [metrics, utilization] = await Promise.all([
      this.getUsageMetrics(organizationId, startDate, endDate),
      this.getResourceUtilization(organizationId),
    ]);

    return {
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
      metrics,
      utilization,
      summary: {
        totalCost: metrics.costByResource.reduce((sum, resource) => sum + resource.cost, 0),
        averageDailyUsage: metrics.totalUsage / metrics.usageByPeriod.length,
        projectedUsage: metrics.projectedUsage,
        trendPercentage: metrics.trendPercentage,
      },
    };
  }
}