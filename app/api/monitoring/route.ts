import { NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoring-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(searchParams));

    // Convert date strings to Date objects if provided
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    // Get monitoring service instance
    const monitoringService = MonitoringService.getInstance();

    // Get system health
    const health = await monitoringService.getSystemHealth();

    // Get performance metrics
    const metrics = await monitoringService.getPerformanceMetrics({
      startDate,
      endDate,
    });

    return NextResponse.json({
      health,
      metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to get monitoring data:', error);
    return NextResponse.json(
      { error: 'Failed to get monitoring data' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const monitoringService = MonitoringService.getInstance();
    const health = await monitoringService.getSystemHealth();

    return new NextResponse(null, {
      status: health.status === 'healthy' ? 200 : 503,
      headers: {
        'X-Health-Status': health.status,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return new NextResponse(null, { status: 503 });
  }
} 