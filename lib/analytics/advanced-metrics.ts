  upperBound: number;
  lowerBound: number;
  confidence: number;
}

interface CustomerMetrics {
  acquisitionCost: number;
  lifetimeValue: number;
  paybackPeriod: number;
  churnRate: number;
  retentionRate: number;
  netPromoterScore: number;
}

interface ProductMetrics {
  revenueByProduct: Record<string, number>;
  customerCountByProduct: Record<string, number>;
  growthByProduct: Record<string, number>;
  averageOrderValue: number;
}

export class AdvancedAnalyticsService {
  static async getRevenueForecast(months: number = 12): Promise<RevenueForecast[]> {
    // Get historical revenue data
    const historicalData = await prisma.payment.findMany({
      where: {
        status: 'completed',
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate moving average and standard deviation
    const monthlyData = this.aggregateMonthlyData(historicalData);
    const movingAverage = this.calculateMovingAverage(monthlyData);
    const stdDev = this.calculateStandardDeviation(monthlyData);

    // Generate forecast
    const forecast: RevenueForecast[] = [];
    const lastValue = monthlyData[monthlyData.length - 1];
    const lastDate = new Date(historicalData[historicalData.length - 1].createdAt);

    for (let i = 0; i < months; i++) {
      const date = new Date(lastDate);
      date.setMonth(date.getMonth() + i + 1);
      
      const predicted = lastValue * (1 + movingAverage);
      const confidence = 0.95; // 95% confidence interval
      const margin = stdDev * 1.96; // 1.96 is the z-score for 95% confidence

      forecast.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        predicted,
        upperBound: predicted + margin,
        lowerBound: predicted - margin,
        confidence,
      });
    }

    return forecast;
  }

  static async getCustomerMetrics(): Promise<CustomerMetrics> {
    // Get customer data
    const customers = await prisma.customer.findMany({
      include: {
        subscriptions: true,
        payments: {
          where: {
            status: 'completed',
          },
        },
      },
    });

    // Calculate metrics
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.subscriptions.some(s => s.status === 'active')).length;
    const churnedCustomers = customers.filter(c => c.subscriptions.some(s => s.status === 'cancelled')).length;

    // Calculate acquisition cost (total marketing spend / total customers)
    const marketingSpend = await this.getMarketingSpend();
    const acquisitionCost = marketingSpend / totalCustomers;

    // Calculate lifetime value (average revenue per customer)
    const totalRevenue = customers.reduce((sum, c) => 
      sum + c.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);
    const lifetimeValue = totalRevenue / totalCustomers;

    // Calculate payback period (acquisition cost / monthly revenue per customer)
    const monthlyRevenuePerCustomer = lifetimeValue / 12;
    const paybackPeriod = acquisitionCost / monthlyRevenuePerCustomer;

    // Calculate churn rate
    const churnRate = (churnedCustomers / totalCustomers) * 100;

    // Calculate retention rate
    const retentionRate = ((totalCustomers - churnedCustomers) / totalCustomers) * 100;

    // Calculate NPS (simplified version)
    const netPromoterScore = await this.calculateNetPromoterScore();

    return {
      acquisitionCost,
      lifetimeValue,
      paybackPeriod,
      churnRate,
      retentionRate,
      netPromoterScore,
    };
  }

import { prisma } from '../prisma';
import { addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CurrencyService } from '../currency';

interface RevenueForecast {
  month: string;
  predicted: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

interface CustomerMetrics {
  acquisitionCost: number;
  lifetimeValue: number;
  paybackPeriod: number;
  churnRate: number;
  retentionRate: number;
  netPromoterScore: number;
}

interface ProductMetrics {
  revenueByProduct: Record<string, number>;
  growthByProduct: Record<string, number>;
  customerCountByProduct: Record<string, number>;
  averageOrderValue: Record<string, number>;
}

export class AdvancedAnalyticsService {
  static async getRevenueForecast(months: number = 12): Promise<RevenueForecast[]> {
    // Get historical revenue data
    const historicalData = await prisma.invoice.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: subMonths(new Date(), 24), // Use 2 years of data for better forecasting
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by month
    const monthlyData = historicalData.reduce((acc, invoice) => {
      const month = startOfMonth(invoice.createdAt).toISOString();
      acc[month] = (acc[month] || 0) + invoice.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    // Calculate moving average and standard deviation
    const values = Object.values(monthlyData);
    const movingAverage = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - movingAverage, 2), 0) / values.length
    );

    // Generate forecast
    const forecast: RevenueForecast[] = [];
    const lastMonth = endOfMonth(new Date());
    
    for (let i = 0; i < months; i++) {
      const month = addMonths(lastMonth, i + 1);
      const predicted = movingAverage * (1 + (i * 0.02)); // 2% growth assumption
      const confidence = Math.max(0.5, 1 - (i * 0.05)); // Decreasing confidence over time
      
      forecast.push({
        month: month.toISOString(),
        predicted,
        confidence,
        upperBound: predicted + (stdDev * confidence),
        lowerBound: predicted - (stdDev * confidence),
      });
    }

    return forecast;
  }

  static async getCustomerMetrics(): Promise<CustomerMetrics> {
    // Calculate Customer Acquisition Cost (CAC)
    const marketingCosts = await prisma.expense.findMany({
      where: {
        category: 'MARKETING',
        createdAt: {
          gte: subMonths(new Date(), 12),
        },
      },
      select: {
        amount: true,
      },
    });

    const newCustomers = await prisma.organization.count({
      where: {
        createdAt: {
          gte: subMonths(new Date(), 12),
        },
      },
    });

    const totalMarketingCost = marketingCosts.reduce((sum, expense) => sum + expense.amount, 0);
    const acquisitionCost = newCustomers > 0 ? totalMarketingCost / newCustomers : 0;

    // Calculate Customer Lifetime Value (CLV)
    const customerRevenue = await prisma.invoice.aggregate({
      where: {
        status: 'PAID',
      },
      _sum: {
        totalAmount: true,
      },
    });

    const totalCustomers = await prisma.organization.count();
    const lifetimeValue = totalCustomers > 0 
      ? (customerRevenue._sum.totalAmount || 0) / totalCustomers 
      : 0;

    // Calculate Churn Rate
    const churnedCustomers = await prisma.organization.count({
      where: {
        subscriptions: {
          every: {
            status: 'CANCELED',
          },
        },
      },
    });

    const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
    const retentionRate = 100 - churnRate;

    // Calculate Payback Period
    const paybackPeriod = acquisitionCost > 0 
      ? acquisitionCost / (lifetimeValue / 12) // Months to recover CAC
      : 0;

    // Calculate Net Promoter Score (NPS)
    const surveyResponses = await prisma.surveyResponse.findMany({
      where: {
        type: 'NPS',
        createdAt: {
          gte: subMonths(new Date(), 3),
        },
      },
      select: {
        score: true,
      },
    });

    const nps = surveyResponses.length > 0
      ? surveyResponses.reduce((sum, response) => sum + response.score, 0) / surveyResponses.length
      : 0;

    return {
      acquisitionCost,
      lifetimeValue,
      paybackPeriod,
      churnRate,
      retentionRate,
      netPromoterScore: nps,
    };
  }

  static async getProductMetrics(): Promise<ProductMetrics> {
    // Get revenue by product
    const revenueByProduct = await prisma.invoice.groupBy({
      by: ['subscription.planId'],
      _sum: {
        totalAmount: true,
      },
    });

    // Get customer count by product
    const customerCountByProduct = await prisma.subscription.groupBy({
      by: ['planId'],
      _count: true,
    });

    // Calculate growth by product
    const previousPeriod = await prisma.invoice.groupBy({
      by: ['subscription.planId'],
      where: {
        createdAt: {
          gte: subMonths(new Date(), 12),
          lt: subMonths(new Date(), 6),
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    const currentPeriod = await prisma.invoice.groupBy({
      by: ['subscription.planId'],
      where: {
        createdAt: {
          gte: subMonths(new Date(), 6),
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    const growthByProduct = currentPeriod.reduce((acc, curr) => {
      const previous = previousPeriod.find(p => p.planId === curr.planId);
      const growth = previous
        ? ((curr._sum.totalAmount || 0) - (previous._sum.totalAmount || 0)) / (previous._sum.totalAmount || 1) * 100
        : 0;
      acc[curr.planId] = growth;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average order value by product
    const averageOrderValue = revenueByProduct.reduce((acc, curr) => {
      const customerCount = customerCountByProduct.find(c => c.planId === curr.planId)?._count || 1;
      acc[curr.planId] = (curr._sum.totalAmount || 0) / customerCount;
      return acc;
    }, {} as Record<string, number>);

    return {
      revenueByProduct: revenueByProduct.reduce((acc, curr) => ({
        ...acc,
        [curr.planId]: curr._sum.totalAmount || 0,
      }), {}),
      growthByProduct,
      customerCountByProduct: customerCountByProduct.reduce((acc, curr) => ({
        ...acc,
        [curr.planId]: curr._count,
      }), {}),
      averageOrderValue,
    };
  }

  static async generateReport(type: 'revenue' | 'customers' | 'products'): Promise<string> {
    let report = '';
    const timestamp = new Date().toISOString();

    switch (type) {
      case 'revenue':
        const forecast = await this.getRevenueForecast();
        report = `Revenue Forecast Report (${timestamp})\n\n`;
        report += 'Month,Predicted Revenue,Confidence,Upper Bound,Lower Bound\n';
        forecast.forEach(f => {
          report += `${f.month},${f.predicted},${f.confidence},${f.upperBound},${f.lowerBound}\n`;
        });
        break;

      case 'customers':
        const customerMetrics = await this.getCustomerMetrics();
        report = `Customer Metrics Report (${timestamp})\n\n`;
        report += 'Metric,Value\n';
        report += `Customer Acquisition Cost,${customerMetrics.acquisitionCost}\n`;
        report += `Customer Lifetime Value,${customerMetrics.lifetimeValue}\n`;
        report += `Payback Period (months),${customerMetrics.paybackPeriod}\n`;
        report += `Churn Rate (%),${customerMetrics.churnRate}\n`;
        report += `Retention Rate (%),${customerMetrics.retentionRate}\n`;
        report += `Net Promoter Score,${customerMetrics.netPromoterScore}\n`;
        break;

      case 'products':
        const productMetrics = await this.getProductMetrics();
        report = `Product Metrics Report (${timestamp})\n\n`;
        report += 'Product ID,Revenue,Growth (%),Customer Count,Average Order Value\n';
        Object.keys(productMetrics.revenueByProduct).forEach(productId => {
          report += `${productId},`;
          report += `${productMetrics.revenueByProduct[productId]},`;
          report += `${productMetrics.growthByProduct[productId]},`;
          report += `${productMetrics.customerCountByProduct[productId]},`;
          report += `${productMetrics.averageOrderValue[productId]}\n`;
        });
        break;
    }

    return report;
  }
} 