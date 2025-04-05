import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics-service';
import { CurrencyService } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!organizationId || !type) {
      return NextResponse.json({ error: 'Organization ID and type are required' }, { status: 400 });
    }

    // Parse date range
    let dateRange = {
      startDate: from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: to ? new Date(to) : new Date(),
    };

    // Initialize analytics service
    const analyticsService = AnalyticsService.getInstance();
    let csvContent = '';

    switch (type) {
      case 'revenue': {
        const [revenue, revenueOverTime, revenueForecast] = await Promise.all([
          analyticsService.getRevenueMetrics(organizationId),
          analyticsService.getRevenueTimeSeries(organizationId),
          analyticsService.getRevenueMetrics(organizationId).then(async (metrics) => {
            const data = await generateRevenueForecast(revenueOverTime);
            return data;
          })
        ]);

        csvContent = generateRevenueReport(revenue, revenueOverTime, revenueForecast);
        break;
      }

      case 'subscriptions': {
        const [subscriptions, subscriptionsOverTime] = await Promise.all([
          analyticsService.getSubscriptionAnalytics(organizationId),
          analyticsService.getSubscriptionTimeSeries(organizationId)
        ]);

        csvContent = generateSubscriptionReport(subscriptions, subscriptionsOverTime);
        break;
      }

      case 'customers': {
        const [customers, customerRetention] = await Promise.all([
          analyticsService.getCustomerAnalytics(organizationId),
          analyticsService.getCustomerRetention(organizationId)
        ]);

        csvContent = generateCustomerReport(customers, customerRetention);
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=${type}-analytics-${new Date().toISOString()}.csv`
      }
    });
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics data' },
      { status: 500 }
    );
  }
}

function generateRevenueReport(revenue: any, revenueOverTime: any, revenueForecast: any): string {
  let csv = 'Revenue Metrics Report\n\n';
  
  // Current Metrics
  csv += 'Current Metrics\n';
  csv += 'Metric,Value\n';
  csv += `MRR,${CurrencyService.formatCurrency(revenue.mrr, 'USD')}\n`;
  csv += `ARR,${CurrencyService.formatCurrency(revenue.arr, 'USD')}\n`;
  csv += `Growth,${revenue.growth.percentage}%\n`;
  csv += `Net Revenue Retention,${revenue.netRevenueRetention}%\n`;
  csv += `Gross Revenue Retention,${revenue.grossRevenueRetention}%\n\n`;

  // Historical Revenue
  csv += 'Historical Revenue\n';
  csv += 'Date,Total Revenue,Subscription Revenue\n';
  revenueOverTime[0].data.forEach((entry: any, index: number) => {
    csv += `${entry.date},${entry.value},${revenueOverTime[1].data[index].value}\n`;
  });
  csv += '\n';

  // Revenue Forecast
  csv += 'Revenue Forecast\n';
  csv += 'Month,Predicted Revenue,Lower Bound,Upper Bound\n';
  revenueForecast.forEach((forecast: any) => {
    csv += `${forecast.month},${forecast.predicted},${forecast.lowerBound},${forecast.upperBound}\n`;
  });

  return csv;
}

function generateSubscriptionReport(subscriptions: any, subscriptionsOverTime: any): string {
  let csv = 'Subscription Metrics Report\n\n';

  // Current Metrics
  csv += 'Current Metrics\n';
  csv += 'Metric,Value\n';
  csv += `Total Subscriptions,${subscriptions.totalSubscriptions}\n`;
  csv += `Active Subscriptions,${subscriptions.activeSubscriptions}\n`;
  csv += `Churn Rate,${subscriptions.churnRate}%\n`;
  csv += `Average Contract Value,${CurrencyService.formatCurrency(subscriptions.averageSubscriptionValue, 'USD')}\n\n`;

  // Subscription Trends
  csv += 'Subscription Trends\n';
  csv += 'Date,New Subscriptions,Cancellations\n';
  subscriptionsOverTime[0].data.forEach((entry: any, index: number) => {
    csv += `${entry.date},${entry.value},${subscriptionsOverTime[1].data[index].value}\n`;
  });

  return csv;
}

function generateCustomerReport(customers: any, customerRetention: any): string {
  let csv = 'Customer Metrics Report\n\n';

  // Current Metrics
  csv += 'Current Metrics\n';
  csv += 'Metric,Value\n';
  csv += `Total Customers,${customers.totalCustomers}\n`;
  csv += `Active Customers,${customers.activeCustomers}\n`;
  csv += `Customer Lifetime Value,${CurrencyService.formatCurrency(customers.customerLifetimeValue, 'USD')}\n`;
  csv += `Growth Rate,${customers.growth.percentage}%\n\n`;

  // Retention Data
  csv += 'Customer Retention\n';
  csv += 'Month,Retention Rate\n';
  customerRetention.labels.forEach((label: string, index: number) => {
    csv += `${label},${customerRetention.retention[index]}%\n`;
  });

  return csv;
}

async function generateRevenueForecast(historicalData: any[]) {
  // Simple linear regression for forecasting
  const data = historicalData[0].data;
  const values = data.map((d: any) => d.value);
  const n = values.length;
  
  const sum = values.reduce((a: number, b: number) => a + b, 0);
  const mean = sum / n;
  const trend = (values[n - 1] - values[0]) / n;
  
  const forecast = [];
  const lastValue = values[n - 1];
  const lastDate = new Date(data[n - 1].date);
  
  for (let i = 1; i <= 12; i++) {
    const predictedValue = lastValue + (trend * i);
    const uncertainty = Math.sqrt(i) * (mean * 0.1);
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + i);
    
    forecast.push({
      month: date.toISOString().split('T')[0].substring(0, 7),
      predicted: Math.max(0, predictedValue),
      upperBound: Math.max(0, predictedValue + uncertainty),
      lowerBound: Math.max(0, predictedValue - uncertainty)
    });
  }
  
  return forecast;
}