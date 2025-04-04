import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';
import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';

// Analytics metrics schema
const AnalyticsMetricsSchema = z.object({
  revenue: z.object({
    total: z.number(),
    recurring: z.number(),
    oneTime: z.number(),
    byPlan: z.record(z.string(), z.number()),
    byCurrency: z.record(z.string(), z.number()),
  }),
  subscriptions: z.object({
    total: z.number(),
    active: z.number(),
    canceled: z.number(),
    byPlan: z.record(z.string(), z.number()),
    byStatus: z.record(z.string(), z.number()),
  }),
  customers: z.object({
    total: z.number(),
    active: z.number(),
    churned: z.number(),
    new: z.number(),
    byPlan: z.record(z.string(), z.number()),
  }),
  usage: z.object({
    total: z.number(),
    byFeature: z.record(z.string(), z.number()),
    byCustomer: z.record(z.string(), z.number()),
  }),
  errorRate: z.number(),
});

export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>;

export type TimeFrame = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut';

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

export interface InvoiceSummary {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  invoiceAmountPaid: number;
  invoiceAmountDue: number;
}

export interface TimeSeries {
  label: string;
  data: Array<{
    date: string;
    value: number;
  }>;
}

export interface AnalyticsDashboardData {
  revenue: RevenueSummary;
  subscriptions: SubscriptionSummary;
  customers: CustomerSummary;
  invoices: InvoiceSummary;
  revenueOverTime: TimeSeries[];
  subscriptionsOverTime: TimeSeries[];
  topPlans: Array<{
    id: string;
    name: string;
    subscriberCount: number;
    revenue: number;
  }>;
  customerRetention: {
    labels: string[];
    retention: number[];
  };
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public async getMetrics(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ): Promise<AnalyticsMetrics> {
    try {
      const [revenue, subscriptions, customers, usage, errorRate] = await Promise.all([
        this.getRevenueMetrics(startDate, endDate, organizationId),
        this.getSubscriptionMetrics(startDate, endDate, organizationId),
        this.getCustomerMetrics(startDate, endDate, organizationId),
        this.getUsageMetrics(startDate, endDate, organizationId),
        this.getErrorRate(startDate, endDate, organizationId),
      ]);

      const metrics = {
        revenue,
        subscriptions,
        customers,
        usage,
        errorRate,
      };

      return AnalyticsMetricsSchema.parse(metrics);
    } catch (error) {
      console.error('Error fetching analytics metrics:', error);
      await createEvent({
        type: 'ANALYTICS_ERROR',
        severity: 'ERROR',
        message: 'Failed to fetch analytics metrics',
        metadata: { error },
      });
      throw error;
    }
  }

  private async getRevenueMetrics(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ) {
    const where = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          amount: true,
          currency: true,
          subscription: {
            select: {
              plan: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where,
        select: {
          amount: true,
          currency: true,
          type: true,
        },
      }),
    ]);

    const byPlan = invoices.reduce((acc, invoice) => {
      const plan = invoice.subscription?.plan || 'Unknown';
      acc[plan] = (acc[plan] || 0) + invoice.amount;
      return acc;
    }, {} as Record<string, number>);

    const byCurrency = invoices.reduce((acc, invoice) => {
      acc[invoice.currency] = (acc[invoice.currency] || 0) + invoice.amount;
      return acc;
    }, {} as Record<string, number>);

    const recurring = payments
      .filter((p) => p.type === 'RECURRING')
      .reduce((sum, p) => sum + p.amount, 0);

    const oneTime = payments
      .filter((p) => p.type === 'ONE_TIME')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      total: invoices.reduce((sum, i) => sum + i.amount, 0),
      recurring,
      oneTime,
      byPlan,
      byCurrency,
    };
  }

  private async getSubscriptionMetrics(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ) {
    const where = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    const subscriptions = await prisma.subscription.findMany({
      where,
      select: {
        status: true,
        plan: true,
      },
    });

    const byPlan = subscriptions.reduce((acc, sub) => {
      acc[sub.plan] = (acc[sub.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = subscriptions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
      canceled: subscriptions.filter((s) => s.status === 'CANCELED').length,
      byPlan,
      byStatus,
    };
  }

  private async getCustomerMetrics(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ) {
    const where = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    const [customers, subscriptions] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          subscriptions: {
            select: {
              plan: true,
              status: true,
            },
          },
        },
      }),
      prisma.subscription.findMany({
        where,
        select: {
          customerId: true,
          plan: true,
        },
      }),
    ]);

    const byPlan = subscriptions.reduce((acc, sub) => {
      acc[sub.plan] = (acc[sub.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activeCustomers = new Set(
      customers.filter((c) =>
        c.subscriptions.some((s) => s.status === 'ACTIVE')
      ).map((c) => c.id)
    );

    const churnedCustomers = new Set(
      customers.filter((c) =>
        c.subscriptions.every((s) => s.status === 'CANCELED')
      ).map((c) => c.id)
    );

    const newCustomers = customers.filter(
      (c) =>
        startDate && new Date(c.createdAt) >= startDate
    ).length;

    return {
      total: customers.length,
      active: activeCustomers.size,
      churned: churnedCustomers.size,
      new: newCustomers,
      byPlan,
    };
  }

  private async getUsageMetrics(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ) {
    const where = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    const usageRecords = await prisma.usageRecord.findMany({
      where,
      select: {
        feature: true,
        customerId: true,
        quantity: true,
      },
    });

    const byFeature = usageRecords.reduce((acc, record) => {
      acc[record.feature] = (acc[record.feature] || 0) + record.quantity;
      return acc;
    }, {} as Record<string, number>);

    const byCustomer = usageRecords.reduce((acc, record) => {
      acc[record.customerId] = (acc[record.customerId] || 0) + record.quantity;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: usageRecords.reduce((sum, r) => sum + r.quantity, 0),
      byFeature,
      byCustomer,
    };
  }

  private async getErrorRate(
    startDate?: Date,
    endDate?: Date,
    organizationId?: string
  ): Promise<number> {
    const where = {
      type: 'ERROR',
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    const [errorEvents, totalEvents] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.count({
        where: {
          ...where,
          type: undefined,
        },
      }),
    ]);

    return totalEvents > 0 ? errorEvents / totalEvents : 0;
  }

  /**
   * Get the start date for a time frame relative to the current date
   */
  private getStartDateForTimeFrame(timeFrame: TimeFrame): Date {
    const now = new Date();
    
    switch (timeFrame) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'quarter':
        return new Date(now.setMonth(now.getMonth() - 3));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }

  /**
   * Get the previous time frame's start and end dates
   */
  private getPreviousTimeFrame(timeFrame: TimeFrame): { start: Date; end: Date } {
    const now = new Date();
    const currentStart = this.getStartDateForTimeFrame(timeFrame);
    
    // The previous period has the same length as the current one
    const periodLength = now.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1); // 1ms before current start
    const previousStart = new Date(previousEnd.getTime() - periodLength);
    
    return { start: previousStart, end: previousEnd };
  }

  /**
   * Calculate growth percentage between current and previous values
   */
  private calculateGrowth(current: number, previous: number): { percentage: number; trend: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
      return current > 0 
        ? { percentage: 100, trend: 'up' } 
        : { percentage: 0, trend: 'neutral' };
    }
    
    const growthRate = ((current - previous) / previous) * 100;
    
    return {
      percentage: Math.abs(Math.round(growthRate * 10) / 10), // Round to 1 decimal place
      trend: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'neutral',
    };
  }

  /**
   * Get revenue analytics for an organization
   */
  public async getRevenueAnalytics(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<RevenueSummary> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    const { start: previousStart, end: previousEnd } = this.getPreviousTimeFrame(timeFrame);
    
    // Get current period payments
    const currentPayments = await prisma.oneTimePayment.aggregate({
      where: {
        organizationId,
        createdAt: { gte: startDate },
        status: PaymentStatus.COMPLETED,
      },
      _sum: {
        amount: true,
        refundedAmount: true,
      },
    });
    
    // Get previous period payments
    const previousPayments = await prisma.oneTimePayment.aggregate({
      where: {
        organizationId,
        createdAt: { gte: previousStart, lte: previousEnd },
        status: PaymentStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
    });
    
    // Get subscription revenue
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });
    
    const subscriberRevenue = subscriptions.reduce((total, sub) => {
      return total + (sub.plan?.price || 0);
    }, 0);
    
    // Get one-time payments
    const oneTimePayments = await prisma.oneTimePayment.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
        status: PaymentStatus.COMPLETED,
        invoiceId: null, // Not related to a subscription invoice
      },
    });
    
    const oneTimeRevenue = oneTimePayments.reduce((total, payment) => {
      return total + payment.amount;
    }, 0);
    
    // Calculate total revenue
    const totalRevenue = (currentPayments._sum.amount || 0);
    const refundedAmount = (currentPayments._sum.refundedAmount || 0);
    const netRevenue = totalRevenue - refundedAmount;
    const previousRevenue = (previousPayments._sum.amount || 0);
    
    return {
      totalRevenue,
      subscriberRevenue,
      oneTimeRevenue,
      recurringRevenue: totalRevenue - oneTimeRevenue,
      refundedAmount,
      netRevenue,
      growth: this.calculateGrowth(netRevenue, previousRevenue),
    };
  }

  /**
   * Get subscription analytics for an organization
   */
  public async getSubscriptionAnalytics(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<SubscriptionSummary> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    const { start: previousStart, end: previousEnd } = this.getPreviousTimeFrame(timeFrame);
    
    // Get current active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
    });
    
    // Get canceled subscriptions in current period
    const canceledSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        status: 'CANCELED',
        updatedAt: { gte: startDate },
      },
    });
    
    // Get paused subscriptions
    const pausedSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        status: 'PAUSED',
      },
    });
    
    // Get total subscriptions (including historical)
    const totalSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
      },
    });
    
    // Get active subscriptions in the previous period
    const previousActiveSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        createdAt: { lte: previousEnd },
      },
    });
    
    // Calculate churn rate
    const churnRate = activeSubscriptions > 0
      ? (canceledSubscriptions / activeSubscriptions) * 100
      : 0;
    
    // Calculate average subscription value
    const subscriptionsWithValue = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });
    
    const totalValue = subscriptionsWithValue.reduce((total, sub) => {
      return total + (sub.plan?.price || 0);
    }, 0);
    
    const averageSubscriptionValue = activeSubscriptions > 0
      ? totalValue / activeSubscriptions
      : 0;
    
    return {
      totalSubscriptions,
      activeSubscriptions,
      canceledSubscriptions,
      pausedSubscriptions,
      averageSubscriptionValue,
      churnRate,
      growth: this.calculateGrowth(activeSubscriptions, previousActiveSubscriptions),
    };
  }

  /**
   * Get customer analytics for an organization
   */
  public async getCustomerAnalytics(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<CustomerSummary> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    const { start: previousStart, end: previousEnd } = this.getPreviousTimeFrame(timeFrame);
    
    // Get total customers
    const totalCustomers = await prisma.customer.count({
      where: {
        organizationId,
      },
    });
    
    // Get active customers (with active subscriptions)
    const activeCustomers = await prisma.customer.count({
      where: {
        organizationId,
        subscriptions: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
    });
    
    // Get new customers in current period
    const newCustomers = await prisma.customer.count({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
    });
    
    // Get new customers in previous period
    const previousNewCustomers = await prisma.customer.count({
      where: {
        organizationId,
        createdAt: { gte: previousStart, lte: previousEnd },
      },
    });
    
    // Calculate inactive customers
    const inactiveCustomers = totalCustomers - activeCustomers;
    
    // Calculate average customer lifetime value
    const allPayments = await prisma.oneTimePayment.groupBy({
      by: ['customerId'],
      where: {
        organizationId,
        status: PaymentStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
    });
    
    const totalRevenue = allPayments.reduce((total, payment) => {
      return total + (payment._sum.amount || 0);
    }, 0);
    
    const customerLifetimeValue = totalCustomers > 0
      ? totalRevenue / totalCustomers
      : 0;
    
    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      newCustomers,
      customerLifetimeValue,
      growth: this.calculateGrowth(newCustomers, previousNewCustomers),
    };
  }

  /**
   * Get invoice analytics for an organization
   */
  public async getInvoiceAnalytics(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<InvoiceSummary> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    
    // Get invoice stats
    const totalInvoices = await prisma.invoice.count({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
    });
    
    const paidInvoices = await prisma.invoice.count({
      where: {
        organizationId,
        status: 'PAID',
        createdAt: { gte: startDate },
      },
    });
    
    const unpaidInvoices = await prisma.invoice.count({
      where: {
        organizationId,
        status: 'OPEN',
        createdAt: { gte: startDate },
      },
    });
    
    const overdueInvoices = await prisma.invoice.count({
      where: {
        organizationId,
        status: 'OPEN',
        dueDate: { lt: new Date() },
        createdAt: { gte: startDate },
      },
    });
    
    // Get invoice amounts
    const paidInvoiceAmount = await prisma.invoice.aggregate({
      where: {
        organizationId,
        status: 'PAID',
        createdAt: { gte: startDate },
      },
      _sum: {
        total: true,
      },
    });
    
    const unpaidInvoiceAmount = await prisma.invoice.aggregate({
      where: {
        organizationId,
        status: 'OPEN',
        createdAt: { gte: startDate },
      },
      _sum: {
        total: true,
      },
    });
    
    return {
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      invoiceAmountPaid: paidInvoiceAmount._sum.total || 0,
      invoiceAmountDue: unpaidInvoiceAmount._sum.total || 0,
    };
  }

  /**
   * Get time series data for revenue
   */
  public async getRevenueTimeSeries(
    organizationId: string,
    timeFrame: TimeFrame = 'month',
    chartType: ChartType = 'line'
  ): Promise<TimeSeries[]> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    
    // Get all payments in the period
    const payments = await prisma.oneTimePayment.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
        status: PaymentStatus.COMPLETED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    // Group by date according to timeframe
    const paymentsByDate = new Map<string, number>();
    const subscriptionsByDate = new Map<string, number>();
    
    payments.forEach(payment => {
      const date = new Date(payment.createdAt);
      let dateKey: string;
      
      switch (timeFrame) {
        case 'day':
          dateKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          // Get the week start (Sunday)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          dateKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'year':
          dateKey = date.getFullYear().toString();
          break;
        default:
          dateKey = date.toISOString().split('T')[0];
      }
      
      // Add payment amount to the date
      const currentAmount = paymentsByDate.get(dateKey) || 0;
      paymentsByDate.set(dateKey, currentAmount + payment.amount);
      
      // If the payment is related to a subscription invoice
      if (payment.invoiceId) {
        const subscriptionAmount = subscriptionsByDate.get(dateKey) || 0;
        subscriptionsByDate.set(dateKey, subscriptionAmount + payment.amount);
      }
    });
    
    // Convert maps to arrays
    const totalRevenue: TimeSeries = {
      label: 'Total Revenue',
      data: Array.from(paymentsByDate.entries()).map(([date, value]) => ({
        date,
        value,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
    
    const subscriptionRevenue: TimeSeries = {
      label: 'Subscription Revenue',
      data: Array.from(subscriptionsByDate.entries()).map(([date, value]) => ({
        date,
        value,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
    
    return [totalRevenue, subscriptionRevenue];
  }

  /**
   * Get time series data for subscriptions
   */
  public async getSubscriptionTimeSeries(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<TimeSeries[]> {
    const startDate = this.getStartDateForTimeFrame(timeFrame);
    
    // Get all subscription events in the period
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    const canceledSubscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'CANCELED',
        updatedAt: { gte: startDate },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });
    
    // Group by date according to timeframe
    const newSubsByDate = new Map<string, number>();
    const canceledSubsByDate = new Map<string, number>();
    
    subscriptions.forEach(sub => {
      const date = new Date(sub.createdAt);
      let dateKey: string;
      
      switch (timeFrame) {
        case 'day':
          dateKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          dateKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'year':
          dateKey = date.getFullYear().toString();
          break;
        default:
          dateKey = date.toISOString().split('T')[0];
      }
      
      // Increment new subscription count for this date
      const currentCount = newSubsByDate.get(dateKey) || 0;
      newSubsByDate.set(dateKey, currentCount + 1);
    });
    
    canceledSubscriptions.forEach(sub => {
      const date = new Date(sub.updatedAt);
      let dateKey: string;
      
      switch (timeFrame) {
        case 'day':
          dateKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          dateKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'year':
          dateKey = date.getFullYear().toString();
          break;
        default:
          dateKey = date.toISOString().split('T')[0];
      }
      
      // Increment canceled subscription count for this date
      const currentCount = canceledSubsByDate.get(dateKey) || 0;
      canceledSubsByDate.set(dateKey, currentCount + 1);
    });
    
    // Convert maps to arrays
    const newSubscriptions: TimeSeries = {
      label: 'New Subscriptions',
      data: Array.from(newSubsByDate.entries()).map(([date, value]) => ({
        date,
        value,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
    
    const cancelations: TimeSeries = {
      label: 'Cancellations',
      data: Array.from(canceledSubsByDate.entries()).map(([date, value]) => ({
        date,
        value,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
    
    return [newSubscriptions, cancelations];
  }

  /**
   * Get top subscription plans by revenue and subscriber count
   */
  public async getTopPlans(
    organizationId: string,
    limit = 5
  ): Promise<Array<{
    id: string;
    name: string;
    subscriberCount: number;
    revenue: number;
  }>> {
    // Get all active subscriptions with their plans
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });
    
    // Group subscriptions by plan
    const planMap = new Map<string, {
      id: string;
      name: string;
      subscriberCount: number;
      revenue: number;
    }>();
    
    subscriptions.forEach(sub => {
      if (!sub.plan) return;
      
      const plan = planMap.get(sub.plan.id) || {
        id: sub.plan.id,
        name: sub.plan.name,
        subscriberCount: 0,
        revenue: 0,
      };
      
      plan.subscriberCount += 1;
      plan.revenue += sub.plan.price || 0;
      
      planMap.set(sub.plan.id, plan);
    });
    
    // Convert to array and sort by revenue
    return Array.from(planMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get customer retention data
   */
  public async getCustomerRetention(
    organizationId: string,
    months = 12
  ): Promise<{
    labels: string[];
    retention: number[];
  }> {
    const now = new Date();
    const labels: string[] = [];
    const retention: number[] = [];
    
    // Calculate retention for each month going back
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      // Format month label
      const monthLabel = monthDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      labels.push(monthLabel);
      
      // Get customers created in this month
      const newCustomers = await prisma.customer.count({
        where: {
          organizationId,
          createdAt: {
            gte: monthDate,
            lte: monthEnd,
          },
        },
      });
      
      if (newCustomers === 0) {
        retention.push(0);
        continue;
      }
      
      // Get those customers that still have active subscriptions
      const retainedCustomers = await prisma.customer.count({
        where: {
          organizationId,
          createdAt: {
            gte: monthDate,
            lte: monthEnd,
          },
          subscriptions: {
            some: {
              status: 'ACTIVE',
            },
          },
        },
      });
      
      // Calculate retention rate
      const retentionRate = (retainedCustomers / newCustomers) * 100;
      retention.push(Math.round(retentionRate));
    }
    
    return { labels, retention };
  }

  /**
   * Get complete analytics dashboard data
   */
  public async getAnalyticsDashboard(
    organizationId: string,
    timeFrame: TimeFrame = 'month'
  ): Promise<AnalyticsDashboardData> {
    const [
      revenue,
      subscriptions,
      customers,
      invoices,
      revenueOverTime,
      subscriptionsOverTime,
      topPlans,
      customerRetention,
    ] = await Promise.all([
      this.getRevenueAnalytics(organizationId, timeFrame),
      this.getSubscriptionAnalytics(organizationId, timeFrame),
      this.getCustomerAnalytics(organizationId, timeFrame),
      this.getInvoiceAnalytics(organizationId, timeFrame),
      this.getRevenueTimeSeries(organizationId, timeFrame),
      this.getSubscriptionTimeSeries(organizationId, timeFrame),
      this.getTopPlans(organizationId),
      this.getCustomerRetention(organizationId),
    ]);
    
    return {
      revenue,
      subscriptions,
      customers,
      invoices,
      revenueOverTime,
      subscriptionsOverTime,
      topPlans,
      customerRetention,
    };
  }
}