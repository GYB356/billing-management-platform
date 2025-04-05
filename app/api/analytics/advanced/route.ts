import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const organizationId = searchParams.get('organizationId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Parse date range
    let dateRange = {
      startDate: from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: to ? new Date(to) : new Date(),
    };

    // Initialize analytics service
    const analyticsService = AnalyticsService.getInstance();

    // Get all metrics
    const [
      revenue,
      subscriptions,
      customers,
      revenueOverTime,
      subscriptionsOverTime,
      topPlans,
      customerRetention
    ] = await Promise.all([
      analyticsService.getRevenueMetrics(organizationId),
      analyticsService.getSubscriptionAnalytics(organizationId),
      analyticsService.getCustomerAnalytics(organizationId),
      analyticsService.getRevenueTimeSeries(organizationId),
      analyticsService.getSubscriptionTimeSeries(organizationId),
      analyticsService.getTopPlans(organizationId),
      analyticsService.getCustomerRetention(organizationId)
    ]);

    // Generate revenue forecast
    const revenueForecast = await generateRevenueForecast(revenueOverTime);

    return NextResponse.json({
      revenue,
      subscriptions,
      customers,
      revenueOverTime,
      subscriptionsOverTime,
      topPlans,
      customerRetention,
      revenueForecast
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

async function generateRevenueForecast(historicalData: any[]) {
  // Simple linear regression for forecasting
  const data = historicalData[0].data; // Get the total revenue time series
  const values = data.map((d: any) => d.value);
  const n = values.length;
  
  // Calculate trend
  const sum = values.reduce((a: number, b: number) => a + b, 0);
  const mean = sum / n;
  const trend = (values[n - 1] - values[0]) / n;
  
  // Generate forecast for next 12 months
  const forecast = [];
  const lastValue = values[n - 1];
  const lastDate = new Date(data[n - 1].date);
  
  for (let i = 1; i <= 12; i++) {
    const predictedValue = lastValue + (trend * i);
    const uncertainty = Math.sqrt(i) * (mean * 0.1); // Increasing uncertainty over time
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + i);
    
    forecast.push({
      month: date.toISOString().split('T')[0].substring(0, 7), // YYYY-MM format
      predicted: Math.max(0, predictedValue),
      upperBound: Math.max(0, predictedValue + uncertainty),
      lowerBound: Math.max(0, predictedValue - uncertainty)
    });
  }
  
  return forecast;
}