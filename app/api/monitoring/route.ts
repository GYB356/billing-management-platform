import { NextResponse } from 'next/server';
import { MonitoringService } from '@/app/services/monitoring/MonitoringService';
import { AnomalyDetectionService } from '@/app/services/monitoring/AnomalyDetectionService';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const monitoringService = new MonitoringService();
const anomalyDetectionService = new AnomalyDetectionService();

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const metricName = searchParams.get('metricName');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (!metricName) {
      return NextResponse.json({ error: 'Metric name is required' }, { status: 400 });
    }

    const startDate = startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = endTime ? new Date(endTime) : new Date();

    // Get metrics
    const metrics = await monitoringService.getMetrics(metricName, startDate, endDate);

    // Get anomaly detection results
    const anomalies = await anomalyDetectionService.detectAnomalies(metricName, startDate, endDate);

    // Get trend analysis
    const trend = await anomalyDetectionService.analyzeTrend(metricName, startDate, endDate);

    return NextResponse.json({
      metrics,
      anomalies,
      trend,
    });
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, value, tags } = body;

    if (!name || value === undefined) {
      return NextResponse.json(
        { error: 'Name and value are required' },
        { status: 400 }
      );
    }

    const metric = await monitoringService.recordMetric(name, value, tags);

    return NextResponse.json(metric);
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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