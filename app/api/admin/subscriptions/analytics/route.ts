import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      canceledSubscriptions,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.subscription.count({
        where: { status: 'TRIALING' },
      }),
      prisma.subscription.count({
        where: { status: 'CANCELED' },
      }),
      prisma.subscription.aggregate({
        where: {
          status: 'ACTIVE',
          currentPeriodStart: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        },
        _sum: {
          price: true,
        },
      }),
    ]);

    const churnRate =
      totalSubscriptions > 0
        ? (canceledSubscriptions / totalSubscriptions) * 100
        : 0;

    const conversionRate =
      totalSubscriptions > 0
        ? ((activeSubscriptions + trialSubscriptions) / totalSubscriptions) * 100
        : 0;

    return NextResponse.json({
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      canceledSubscriptions,
      monthlyRevenue: monthlyRevenue._sum.price || 0,
      churnRate,
      conversionRate,
    });
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
} 