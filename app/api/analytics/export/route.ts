import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RevenueForecastService } from '@/lib/services/revenue-forecast';
import { CohortAnalysisService } from '@/lib/services/cohort-analysis';
import { CustomerAnalyticsService } from '@/lib/services/customer-analytics';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'revenue';
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : null;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : null;

    let csvContent = '';
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');

    switch (type) {
      case 'revenue': {
        const [metrics, forecast] = await Promise.all([
          RevenueForecastService.getCurrentMetrics(),
          RevenueForecastService.generateForecast()
        ]);

        csvContent = generateRevenueReport(metrics, forecast);
        break;
      }

      case 'customers': {
        const [metrics, cohorts] = await Promise.all([
          CustomerAnalyticsService.getCustomerMetrics(),
          CohortAnalysisService.generateCohortAnalysis()
        ]);

        csvContent = generateCustomerReport(metrics, cohorts);
        break;
      }

      case 'churn': {
        const analysis = await CohortAnalysisService.getChurnAnalysis();
        csvContent = generateChurnReport(analysis);
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    // Create response with CSV content
    const response = new NextResponse(csvContent);
    response.headers.set('Content-Type', 'text/csv');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="analytics_${type}_${timestamp}.csv"`
    );

    return response;

  } catch (error) {
    console.error('Error generating analytics export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

function generateRevenueReport(metrics: any, forecast: any[]): string {
  let csv = 'Revenue Metrics Report\n\n';
  
  // Current metrics
  csv += 'Current Metrics\n';
  csv += 'Metric,Value\n';
  csv += `MRR,${metrics.mrr}\n`;
  csv += `ARR,${metrics.arr}\n`;
  csv += `Growth Rate,${metrics.growth.percentage}%\n`;
  csv += `Net Revenue Retention,${metrics.netRevenueRetention}%\n`;
  csv += `Gross Revenue Retention,${metrics.grossRevenueRetention}%\n`;
  csv += `Revenue Churn,${metrics.revenueChurn}%\n\n`;

  // Forecast
  csv += 'Revenue Forecast\n';
  csv += 'Date,Predicted Revenue,Upper Bound,Lower Bound,Confidence\n';
  forecast.forEach(f => {
    csv += `${format(f.date, 'yyyy-MM-dd')},${f.predicted},${f.upperBound},${f.lowerBound},${f.confidence}\n`;
  });

  return csv;
}

function generateCustomerReport(metrics: any, cohorts: any[]): string {
  let csv = 'Customer Metrics Report\n\n';
  
  // Overview metrics
  csv += 'Overview Metrics\n';
  csv += 'Metric,Value\n';
  csv += `Customer Lifetime Value,${metrics.ltv}\n`;
  csv += `Customer Acquisition Cost,${metrics.cac}\n`;
  csv += `LTV/CAC Ratio,${metrics.ltvCacRatio}\n`;
  csv += `Average Revenue Per User,${metrics.averageRevenuePerUser}\n`;
  csv += `Payback Period (months),${metrics.paybackPeriod}\n\n`;

  // Customer segments
  csv += 'Customer Segments\n';
  csv += 'Segment,Count,Percentage,Average Revenue,Churn Rate\n';
  metrics.segments.forEach((s: any) => {
    csv += `${s.name},${s.count},${s.percentage}%,${s.averageRevenue},${s.churnRate}%\n`;
  });
  csv += '\n';

  // Cohort analysis
  csv += 'Cohort Retention Analysis\n';
  csv += 'Cohort Date,Original Count,' + 
    Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`).join(',') + '\n';
  
  cohorts.forEach(cohort => {
    csv += `${format(cohort.cohortDate, 'yyyy-MM-dd')},${cohort.originalCount},`;
    csv += cohort.retentionByMonth
      .map(r => `${r.percentage}%`)
      .join(',') + '\n';
  });

  return csv;
}

function generateChurnReport(analysis: any): string {
  let csv = 'Churn Analysis Report\n\n';
  
  // Overview
  csv += 'Overview\n';
  csv += 'Metric,Value\n';
  csv += `Churn Rate,${analysis.rate}%\n`;
  csv += `Churned Customers,${analysis.count}\n`;
  csv += `Lost MRR,${analysis.mrr}\n`;
  csv += `Preventable Churn Count,${analysis.preventableCount}\n\n`;

  // Churn reasons
  csv += 'Churn Reasons\n';
  csv += 'Reason,Count,Percentage\n';
  const totalChurned = analysis.count;
  Object.entries(analysis.reasons).forEach(([reason, count]: [string, any]) => {
    const percentage = (count / totalChurned) * 100;
    csv += `${reason},${count},${percentage.toFixed(1)}%\n`;
  });

  return csv;
}