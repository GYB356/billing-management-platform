import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateRevenueInsights, predictChurn, optimizePricing } from '@/lib/analytics';
import { auth } from '@/lib/auth';

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const analyticsService = new AnalyticsService();
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12');

    const [mrr, churnRate, planDistribution, revenueTimeline] = await Promise.all([
      analyticsService.calculateMRR(),
      analyticsService.calculateChurnRate(),
      analyticsService.getPlanDistribution(),
      analyticsService.getRevenueTimeline(months),
    ]);

    return NextResponse.json({
      mrr,
      churnRate,
      planDistribution,
      revenueTimeline,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
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