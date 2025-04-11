import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UsageAnalyticsService } from '@/lib/services/usage-analytics-service';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!)
      : startOfMonth(subMonths(new Date(), 1));
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : endOfMonth(new Date());

    const analyticsService = new UsageAnalyticsService();
    const report = await analyticsService.generateUsageReport(
      session.user.organizationId,
      startDate,
      endDate
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage analytics' },
      { status: 500 }
    );
  }
} 