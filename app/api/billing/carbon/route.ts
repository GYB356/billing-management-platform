import { NextResponse } from 'next/server';
import { CarbonTracker } from '@/app/billing/features/climate/carbon-tracking';

const carbonTracker = new CarbonTracker();

export async function POST(request: Request) {
  try {
    const { metricType, quantity } = await request.json();

    const metric = carbonTracker.config.trackingMetrics.find(
      (m) => m.type === metricType
    );

    if (!metric) {
      return NextResponse.json(
        { error: 'Invalid metric type' },
        { status: 400 }
      );
    }

    await carbonTracker.trackUsage(metric, quantity);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Carbon tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track carbon usage' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = new Date(searchParams.get('startDate') || '');
    const endDate = new Date(searchParams.get('endDate') || '');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 }
      );
    }

    const footprint = await carbonTracker.getFootprint(startDate, endDate);

    return NextResponse.json(footprint);
  } catch (error) {
    console.error('Carbon footprint fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch carbon footprint' },
      { status: 500 }
    );
  }
} 