import { prisma } from './prisma';
import { stripe } from './stripe';
import { CurrencyService } from './currency';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  confidence: number;
  data: any;
  recommendations?: string[];
}

export async function generateRevenueInsights(
  startDate: Date,
  endDate: Date,
  organizationId: string
): Promise<AnalyticsInsight[]> {
  // Fetch revenue data
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      customer: {
        organizationId,
      },
      status: 'succeeded',
    },
    include: {
      customer: true,
      subscription: true,
    },
  });

  // Prepare data for AI analysis
  const revenueData = payments.map(payment => ({
    amount: payment.amount,
    currency: payment.currency,
    date: payment.createdAt,
    customerId: payment.customerId,
    subscriptionId: payment.subscriptionId,
  }));

  // Generate insights using OpenAI
  const prompt = `Analyze this revenue data and provide key insights:
    ${JSON.stringify(revenueData, null, 2)}
    
    Focus on:
    1. Revenue trends
    2. Customer behavior patterns
    3. Subscription performance
    4. Potential growth opportunities
    
    Format the response as a JSON array of insights with type, title, description, confidence, and recommendations.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a financial analyst AI that provides insights from billing and revenue data."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
  });

  try {
    const insights = JSON.parse(response.choices[0].message.content).insights;
    return insights;
  } catch (error) {
    console.error('Error parsing AI insights:', error);
    return [];
  }
}

export async function predictChurn(organizationId: string): Promise<AnalyticsInsight[]> {
  // Fetch customer behavior data
  const customers = await prisma.customer.findMany({
    where: {
      organizationId,
    },
    include: {
      payments: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
      subscription: true,
    },
  });

  // Prepare data for AI analysis
  const customerData = customers.map(customer => ({
    paymentHistory: customer.payments.map(p => ({
      status: p.status,
      amount: p.amount,
      date: p.createdAt,
    })),
    subscriptionStatus: customer.subscription?.status,
    subscriptionAge: customer.subscription?.createdAt,
  }));

  // Generate churn predictions using OpenAI
  const prompt = `Analyze this customer data and predict churn risk:
    ${JSON.stringify(customerData, null, 2)}
    
    Consider:
    1. Payment failure patterns
    2. Subscription age and status
    3. Payment amount variations
    4. Recent activity patterns
    
    Format the response as a JSON array of insights with type, title, description, confidence, and recommendations for preventing churn.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a customer retention analyst AI that predicts churn risk."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
  });

  try {
    const insights = JSON.parse(response.choices[0].message.content).insights;
    return insights;
  } catch (error) {
    console.error('Error parsing AI churn predictions:', error);
    return [];
  }
}

export async function optimizePricing(organizationId: string): Promise<AnalyticsInsight[]> {
  // Fetch pricing-related data
  const [subscriptions, payments, usageRecords] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        customer: {
          organizationId,
        },
      },
      include: {
        customer: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        customer: {
          organizationId,
        },
      },
    }),
    prisma.usageRecord.findMany({
      where: {
        subscription: {
          customer: {
            organizationId,
          },
        },
      },
    }),
  ]);

  // Prepare data for AI analysis
  const pricingData = {
    subscriptions: subscriptions.map(sub => ({
      planId: sub.planId,
      status: sub.status,
      customer: {
        id: sub.customer.id,
        createdAt: sub.customer.createdAt,
      },
    })),
    payments: payments.map(payment => ({
      amount: payment.amount,
      status: payment.status,
      date: payment.createdAt,
    })),
    usage: usageRecords.map(record => ({
      featureId: record.featureId,
      quantity: record.quantity,
      timestamp: record.timestamp,
    })),
  };

  // Generate pricing optimization insights using OpenAI
  const prompt = `Analyze this pricing and usage data to optimize pricing strategy:
    ${JSON.stringify(pricingData, null, 2)}
    
    Consider:
    1. Usage patterns vs pricing tiers
    2. Customer segments and their value
    3. Price sensitivity indicators
    4. Potential for new pricing tiers or models
    
    Format the response as a JSON array of insights with type, title, description, confidence, and specific pricing recommendations.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a pricing strategy AI that optimizes subscription pricing models."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
  });

  try {
    const insights = JSON.parse(response.choices[0].message.content).insights;
    return insights;
  } catch (error) {
    console.error('Error parsing AI pricing insights:', error);
    return [];
  }
}
