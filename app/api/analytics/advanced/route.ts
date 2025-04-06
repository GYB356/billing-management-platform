import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { subDays, subMonths, parseISO } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') || 'day';

    let startDate: Date;
    let endDate: Date = new Date();

    if (startDateParam && endDateParam) {
      startDate = parseISO(startDateParam);
      endDate = parseISO(endDateParam);
    } else {
      switch (timeRange) {
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        case 'mtd':
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
          break;
        case 'ytd':
          startDate = new Date(endDate.getFullYear(), 0, 1);
          break;
        default: // 30d
          startDate = subDays(endDate, 30);
      }
    }

    const analyticsService = new AnalyticsService();
    const metrics = await analyticsService.getAdvancedMetrics(startDate, endDate);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}