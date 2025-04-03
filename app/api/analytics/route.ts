import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { z } from 'zod';

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = new URL(request.url).searchParams;
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

    return NextResponse.json({
      metrics,
      timestamp: new Date(),
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