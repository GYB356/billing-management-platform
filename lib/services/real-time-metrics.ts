import prisma from '@/lib/prisma';
import { EventEmitter } from 'events';

export interface RealTimeMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  churnRate: number;
  ltv: number;
  customers: {
    total: number;
    active: number;
    new: number;
  };
  revenue: {
    daily: number;
    monthly: number;
    growth: number;
  };
}

class RealTimeMetricsService {
  private static instance: RealTimeMetricsService;
  private emitter: EventEmitter;
  private metrics: RealTimeMetrics;
  private updateInterval: NodeJS.Timeout | null = null;
  private retryAttempts: number = 0;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 5000; // 5 seconds

  private constructor() {
    this.emitter = new EventEmitter();
    this.metrics = {
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      churnRate: 0,
      ltv: 0,
      customers: {
        total: 0,
        active: 0,
        new: 0,
      },
      revenue: {
        daily: 0,
        monthly: 0,
        growth: 0,
      },
    };
  }

  public static getInstance(): RealTimeMetricsService {
    if (!RealTimeMetricsService.instance) {
      RealTimeMetricsService.instance = new RealTimeMetricsService();
    }
    return RealTimeMetricsService.instance;
  }

  public async startUpdates(interval: number = 30000): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    await this.updateMetricsWithRetry();
    this.updateInterval = setInterval(() => this.updateMetricsWithRetry(), interval);
  }

  public stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public onMetricsUpdate(callback: (metrics: RealTimeMetrics) => void): void {
    this.emitter.on('metricsUpdate', callback);
  }

  public removeListener(callback: (metrics: RealTimeMetrics) => void): void {
    this.emitter.off('metricsUpdate', callback);
  }

  public onError(callback: (error: Error) => void): void {
    this.emitter.on('error', callback);
  }

  public removeErrorListener(callback: (error: Error) => void): void {
    this.emitter.off('error', callback);
  }

  private async updateMetricsWithRetry(): Promise<void> {
    try {
      await this.updateMetrics();
      this.retryAttempts = 0; // Reset retry counter on success
    } catch (error) {
      console.error('Error updating metrics:', error);
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        console.log(`Retrying metrics update (attempt ${this.retryAttempts}/${this.maxRetries})...`);
        setTimeout(() => this.updateMetricsWithRetry(), this.retryDelay);
      } else {
        this.emitter.emit('error', error);
        this.retryAttempts = 0; // Reset for next update cycle
      }
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      const [
        subscriptions,
        customers,
        revenue,
        ltv,
      ] = await Promise.all([
        this.getSubscriptionMetrics(),
        this.getCustomerMetrics(),
        this.getRevenueMetrics(),
        this.calculateLTV(),
      ]);

      this.metrics = {
        ...this.metrics,
        ...subscriptions,
        customers,
        revenue,
        ltv,
      };

      this.emitter.emit('metricsUpdate', this.metrics);
    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }

  private async getSubscriptionMetrics() {
    const [active, total, canceled] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'CANCELED' } }),
    ]);

    const churnRate = total > 0 ? (canceled / total) * 100 : 0;
    const mrr = await this.calculateMRR();
    
    return {
      mrr,
      arr: mrr * 12,
      activeSubscriptions: active,
      churnRate,
    };
  }

  private async getCustomerMetrics() {
    const [total, active, newCustomers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: {
          subscriptions: {
            some: { status: 'ACTIVE' }
          }
        }
      }),
      prisma.customer.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
    ]);

    return {
      total,
      active,
      new: newCustomers,
    };
  }

  private async getRevenueMetrics() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.setDate(1));
    const lastMonth = new Date(today.setMonth(today.getMonth() - 1));

    const [daily, monthly, lastMonthly] = await Promise.all([
      this.sumRevenue(startOfDay),
      this.sumRevenue(startOfMonth),
      this.sumRevenue(lastMonth, startOfMonth),
    ]);

    const growth = lastMonthly > 0 ? ((monthly - lastMonthly) / lastMonthly) * 100 : 0;

    return {
      daily,
      monthly,
      growth,
    };
  }

  private async calculateMRR(): Promise<number> {
    const result = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: {
        price: true,
      },
    });

    return result._sum.price || 0;
  }

  private async sumRevenue(start: Date, end?: Date) {
    const result = await prisma.payment.aggregate({
      where: {
        createdAt: {
          gte: start,
          ...(end && { lt: end }),
        },
        status: 'succeeded',
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || 0;
  }

  private async calculateLTV(): Promise<number> {
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'succeeded' },
      _sum: { amount: true },
    });

    const totalCustomers = await prisma.customer.count();
    return totalCustomers > 0 ? (totalRevenue._sum.amount || 0) / totalCustomers : 0;
  }
}

export const realTimeMetricsService = RealTimeMetricsService.getInstance();