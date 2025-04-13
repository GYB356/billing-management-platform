import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for metrics query
const metricsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  interval: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  types: z.array(z.string()).optional(),
  organizationId: z.string().cuid(),
});

// GET /api/metrics - Get metrics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = metricsQuerySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      interval: searchParams.get('interval') || 'day',
      types: searchParams.getAll('type'),
      organizationId: searchParams.get('organizationId'),
    });

    // Default to last 30 days if no dates provided
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate 
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get webhook delivery statistics
    const webhookStats = await prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: {
        webhook: {
          organizationId: query.organizationId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    // Get event statistics
    const eventStats = await prisma.event.groupBy({
      by: ['eventType', 'severity'],
      where: {
        organizationId: query.organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(query.types?.length ? { eventType: { in: query.types } } : {}),
      },
      _count: true,
    });

    // Get time series data
    const timeSeriesData = await prisma.$queryRaw`
      SELECT 
        date_trunc(${query.interval}, "createdAt") as time_bucket,
        count(*) as count,
        status
      FROM webhook_deliveries
      WHERE 
        "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND webhook_id IN (
          SELECT id FROM webhooks 
          WHERE organization_id = ${query.organizationId}
        )
      GROUP BY time_bucket, status
      ORDER BY time_bucket ASC
    `;

    // Get top failing webhooks
    const topFailingWebhooks = await prisma.webhook.findMany({
      where: {
        organizationId: query.organizationId,
        deliveries: {
          some: {
            status: 'FAILED',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      select: {
        id: true,
        url: true,
        _count: {
          select: {
            deliveries: {
              where: {
                status: 'FAILED',
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      orderBy: {
        deliveries: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    // Calculate success rate
    const totalDeliveries = webhookStats.reduce((acc, stat) => acc + stat._count, 0);
    const successfulDeliveries = webhookStats.find(stat => stat.status === 'COMPLETED')?._count || 0;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return NextResponse.json({
      webhookStats: {
        total: totalDeliveries,
        successRate,
        byStatus: webhookStats,
      },
      eventStats: {
        byType: eventStats,
      },
      timeSeries: timeSeriesData,
      topFailingWebhooks,
      period: {
        start: startDate,
        end: endDate,
        interval: query.interval,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// POST /api/metrics/export - Export metrics
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId, format = 'csv', ...query } = body;

    // Validate input
    const validatedQuery = metricsQuerySchema.parse({
      ...query,
      organizationId,
    });

    // Get metrics data (reuse logic from GET handler)
    const endDate = validatedQuery.endDate ? new Date(validatedQuery.endDate) : new Date();
    const startDate = validatedQuery.startDate 
      ? new Date(validatedQuery.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get detailed webhook delivery data
    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhook: {
          organizationId: validatedQuery.organizationId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        webhook: {
          select: {
            url: true,
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
    },
  });

    // Format data based on requested format
    let exportData;
    if (format === 'csv') {
      exportData = deliveries.map(d => ({
        id: d.id,
        webhookUrl: d.webhook.url,
        status: d.status,
        statusCode: d.statusCode,
        createdAt: d.createdAt.toISOString(),
        retries: d.retries,
        error: d.error,
      }));

      // Convert to CSV
      const csv = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
    headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="webhook-metrics-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`,
    },
  });
    }

    // Default to JSON
    return NextResponse.json(deliveries);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error exporting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
} 