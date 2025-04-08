import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get current date and 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get active subscriptions count
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    });

    // Get total revenue for current month
    const currentMonthRevenue = await prisma.invoice.aggregate({
      where: {
        status: 'PAID',
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get previous month revenue for comparison
    const previousMonthRevenue = await prisma.invoice.aggregate({
      where: {
        status: 'PAID',
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Calculate MRR
    const mrr = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
      },
      _sum: {
        amount: true,
      },
    });

    // Get customer growth
    const currentCustomers = await prisma.user.count({
      where: {
        createdAt: {
          lte: now,
        },
      },
    });

    const previousCustomers = await prisma.user.count({
      where: {
        createdAt: {
          lte: thirtyDaysAgo,
        },
      },
    });

    const customerGrowth = previousCustomers > 0
      ? ((currentCustomers - previousCustomers) / previousCustomers) * 100
      : 0;

    // Calculate revenue change
    const currentRevenue = currentMonthRevenue._sum.amount || 0;
    const previousRevenue = previousMonthRevenue._sum.amount || 0;
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const overview = {
      cards: [
        {
          label: 'Monthly Revenue',
          value: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format((currentRevenue || 0) / 100),
          change: revenueChange,
          trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'neutral',
          description: 'Total revenue for the current month',
          icon: '💰',
        },
        {
          label: 'Active Subscriptions',
          value: activeSubscriptions,
          description: 'Number of active subscriptions',
          icon: '📊',
        },
        {
          label: 'MRR',
          value: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format((mrr._sum.amount || 0) / 100),
          description: 'Monthly Recurring Revenue',
          icon: '📈',
        },
        {
          label: 'Customer Growth',
          value: currentCustomers,
          change: customerGrowth,
          trend: customerGrowth > 0 ? 'up' : customerGrowth < 0 ? 'down' : 'neutral',
          description: 'Total customers and growth over last 30 days',
          icon: '👥',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview data' },
      { status: 500 }
    );
  }
}