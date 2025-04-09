import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const query = querySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      organizationId: searchParams.get('organizationId'),
    });

    const analyticsService = AnalyticsService.getInstance();
    const metrics = await analyticsService.getMetrics(
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
      query.organizationId
    );

    // Calculate MRR (Monthly Recurring Revenue)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

    const mrr = activeSubscriptions.reduce((total, sub) => {
      const monthlyAmount = sub.plan.interval === 'yearly' 
        ? sub.plan.price / 12 
        : sub.plan.price;
      return total + monthlyAmount;
    }, 0);

    // Calculate churn rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        status: 'canceled',
        updatedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const totalSubscriptions = await prisma.subscription.count({
      where: {
        organizationId,
        createdAt: {
          lte: thirtyDaysAgo,
        },
      },
    });

    const churnRate = totalSubscriptions > 0 
      ? (canceledSubscriptions / totalSubscriptions) * 100 
      : 0;

    // Save analytics data
    await prisma.analyticsData.create({
      data: {
        period: new Date(),
        metrics: {
          mrr,
          arr: mrr * 12,
          churnRate,
          activeSubscriptions: activeSubscriptions.length,
        },
      },
    });

    return NextResponse.json({
      metrics,
      timestamp: new Date(),
      mrr,
      arr: mrr * 12,
      churnRate,
      activeSubscriptions: activeSubscriptions.length,
    });
  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse(null, { status: 401 });
    }

    const analyticsService = AnalyticsService.getInstance();
    const metrics = await analyticsService.getMetrics();

    return new NextResponse(null, {
      status: 200,
      headers: {
        'x-health-status': 'healthy',
        'x-error-rate': metrics.errorRate.toString(),
      },
    });
  } catch (error) {
    console.error('Error in analytics health check:', error);
    return new NextResponse(null, {
      status: 503,
      headers: {
        'x-health-status': 'unhealthy',
      },
    });
  }
}