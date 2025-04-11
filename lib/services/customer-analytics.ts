import { prisma } from '../prisma';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface CustomerSegment {
  name: string;
  count: number;
  percentage: number;
  averageRevenue: number;
  churnRate: number;
}

export interface CustomerMetrics {
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  averageRevenuePerUser: number;
  paybackPeriod: number;
  segments: CustomerSegment[];
}

export class CustomerAnalyticsService {
  static async getCustomerMetrics(): Promise<CustomerMetrics> {
    const [
      totalRevenue,
      customerCount,
      marketingCosts,
      segments
    ] = await Promise.all([
      // Calculate total revenue
      prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { totalAmount: true }
      }),

      // Get total customers
      prisma.organization.count(),

      // Get marketing costs for CAC
      prisma.expense.aggregate({
        where: { 
          category: 'MARKETING',
          createdAt: {
            gte: subMonths(new Date(), 12)
          }
        },
        _sum: { amount: true }
      }),

      // Get customer segments
      this.generateCustomerSegments()
    ]);

    const ltv = customerCount > 0 ? (totalRevenue._sum.totalAmount || 0) / customerCount : 0;
    const cac = customerCount > 0 ? (marketingCosts._sum.amount || 0) / customerCount : 0;
    const ltvCacRatio = cac > 0 ? ltv / cac : 0;
    const paybackPeriod = cac > 0 ? cac / (ltv / 12) : 0; // In months

    const monthlyRevenue = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { price: true }
    });

    const averageRevenuePerUser = customerCount > 0 
      ? (monthlyRevenue._sum.price || 0) / customerCount 
      : 0;

    return {
      ltv,
      cac,
      ltvCacRatio,
      averageRevenuePerUser,
      paybackPeriod,
      segments
    };
  }

  private static async generateCustomerSegments(): Promise<CustomerSegment[]> {
    const customers = await prisma.organization.findMany({
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { price: true }
        },
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    const totalCustomers = customers.length;
    const segments: Record<string, CustomerSegment> = {
      enterprise: { name: 'Enterprise', count: 0, percentage: 0, averageRevenue: 0, churnRate: 0 },
      growth: { name: 'Growth', count: 0, percentage: 0, averageRevenue: 0, churnRate: 0 },
      smb: { name: 'SMB', count: 0, percentage: 0, averageRevenue: 0, churnRate: 0 },
      starter: { name: 'Starter', count: 0, percentage: 0, averageRevenue: 0, churnRate: 0 }
    };

    // Calculate segment counts and revenue
    customers.forEach(customer => {
      const monthlyRevenue = customer.subscriptions.reduce((sum, sub) => sum + (sub.price || 0), 0);
      
      let segment: keyof typeof segments;
      if (monthlyRevenue >= 5000) {
        segment = 'enterprise';
      } else if (monthlyRevenue >= 1000) {
        segment = 'growth';
      } else if (monthlyRevenue >= 100) {
        segment = 'smb';
      } else {
        segment = 'starter';
      }

      segments[segment].count++;
      segments[segment].averageRevenue += monthlyRevenue;
    });

    // Calculate percentages and averages
    Object.values(segments).forEach(segment => {
      if (segment.count > 0) {
        segment.percentage = (segment.count / totalCustomers) * 100;
        segment.averageRevenue = segment.averageRevenue / segment.count;
      }
    });

    // Calculate churn rate per segment
    for (const segment of Object.keys(segments)) {
      const churnRate = await this.calculateSegmentChurnRate(segment);
      segments[segment].churnRate = churnRate;
    }

    return Object.values(segments);
  }

  private static async calculateSegmentChurnRate(segment: string): Promise<number> {
    const startDate = subMonths(new Date(), 1);
    
    const [churned, total] = await Promise.all([
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          canceledAt: { gte: startDate },
          organization: {
            segment
          }
        }
      }),
      prisma.subscription.count({
        where: {
          organization: {
            segment
          }
        }
      })
    ]);

    return total > 0 ? (churned / total) * 100 : 0;
  }

  static async getCustomerJourney(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'asc' },
          include: {
            plan: true
          }
        },
        invoices: {
          orderBy: { createdAt: 'asc' }
        },
        supportTickets: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }
}