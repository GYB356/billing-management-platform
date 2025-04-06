import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RevenueForecastService } from '@/lib/services/revenue-forecast';
import { CohortAnalysisService } from '@/lib/services/cohort-analysis';
import { CustomerAnalyticsService } from '@/lib/services/customer-analytics';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'month';
    const forecastMonths = parseInt(searchParams.get('forecastMonths') || '12');

    const [
      revenueMetrics,
      revenueForecast,
      cohortAnalysis,
      churnAnalysis,
      customerMetrics
    ] = await Promise.all([
      RevenueForecastService.getCurrentMetrics(),
      RevenueForecastService.generateForecast(forecastMonths),
      CohortAnalysisService.generateCohortAnalysis(),
      CohortAnalysisService.getChurnAnalysis(timeframe as any),
      CustomerAnalyticsService.getCustomerMetrics()
    ]);

    return NextResponse.json({
      revenue: {
        current: revenueMetrics,
        forecast: revenueForecast,
      },
      customers: {
        metrics: customerMetrics,
        cohorts: cohortAnalysis,
      },
      churn: churnAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics metrics' },
      { status: 500 }
    );
  }
}