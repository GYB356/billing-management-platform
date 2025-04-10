import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date and start of month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get plan distribution
    const planDistribution = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        status: 'ACTIVE',
      },
      _count: true,
      orderBy: {
        _count: {
          planId: 'desc',
        },
      },
    });

    // Get plan details for the distribution
    const plans = await prisma.plan.findMany({
      where: {
        id: {
          in: planDistribution.map(p => p.planId),
        },
      },
    });

    // Combine plan details with distribution
    const planDistributionWithDetails = planDistribution.map(dist => ({
      plan: plans.find(p => p.id === dist.planId),
      count: dist._count,
    }));

    // Get churn data for the last 6 months
    const churnData = await prisma.$queryRaw`
      WITH monthly_churn AS (
        SELECT 
          DATE_TRUNC('month', "cancelledAt") as month,
          COUNT(*) as churned_count
        FROM "subscriptions"
        WHERE "status" = 'CANCELLED'
          AND "cancelledAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "cancelledAt")
      )
      SELECT 
        month,
        churned_count
      FROM monthly_churn
      ORDER BY month ASC
    `;

    // Get total active subscriptions
    const totalSubscriptions = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    });

    // Get active trials
    const activeTrials = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        trialEndsAt: {
          gt: now,
        },
      },
    });

    return NextResponse.json({
      planDistribution: planDistributionWithDetails,
      churnData,
      totalSubscriptions,
      activeTrials,
    });
  } catch (error) {
    console.error('Subscription metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription metrics' },
      { status: 500 }
    );
  }
}
