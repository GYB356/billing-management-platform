import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AnalyticsService, DateRange } from '@/lib/services/analytics-service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = new URL(request.url).searchParams;
    
    // Get organization ID (from session or query params)
    const organizationId = searchParams.get('organizationId') || 
                           session.user.organizationId || 
                           'default';
    
    // Parse date range
    let dateRange: DateRange;
    const timeRange = searchParams.get('timeRange');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    const now = new Date();
    const endDate = new Date();
    let startDate = new Date();
    
    if (startDateStr && endDateStr) {
      // Use custom date range if provided
      startDate = new Date(startDateStr);
      dateRange = {
        startDate,
        endDate: new Date(endDateStr)
      };
    } else if (timeRange) {
      // Use predefined time range
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
          break;
        case 'mtd':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
          break;
        default:
          startDate.setDate(now.getDate() - 30); // Default to 30 days
      }
      dateRange = { startDate, endDate };
    } else {
      // Default to last 30 days
      startDate.setDate(now.getDate() - 30);
      dateRange = { startDate, endDate };
    }

    // Get type of metrics requested
    const type = searchParams.get('type') || 'all';
    const format = searchParams.get('format') || 'json';
    
    // Get data based on type
    let responseData: any = {};
    
    switch (type) {
      case 'revenue':
        // Get MRR chart data with appropriate granularity
        const granularity = searchParams.get('granularity') || 'month';
        responseData.revenueData = await AnalyticsService.getMrrChartData(
          organizationId,
          dateRange,
          granularity as 'day' | 'week' | 'month'
        );
        
        // Get revenue forecast for next 12 months
        responseData.revenueForecast = await generateRevenueForecast(
          organizationId,
          dateRange
        );
        break;
        
      case 'customers':
        // Get customer metrics including cohort analysis
        const cohortOptions = {
          timeUnit: searchParams.get('timeUnit') as 'day' | 'week' | 'month' || 'month',
          metrics: ['retention', 'revenue'],
          cohorts: parseInt(searchParams.get('cohorts') || '6', 10),
          periods: parseInt(searchParams.get('periods') || '6', 10)
        };
        
        responseData.cohortAnalysis = await AnalyticsService.getCohortAnalysis(
          organizationId,
          cohortOptions
        );
        
        // Add customer lifetime value and other metrics
        responseData.customerMetrics = await getCustomerMetrics(
          organizationId,
          dateRange
        );
        break;
        
      case 'subscriptions':
        // Get subscription metrics
        responseData.subscriptionData = await getSubscriptionMetrics(
          organizationId,
          dateRange
        );
        break;
        
      case 'products':
        // Get product metrics
        responseData.productMetrics = await getProductMetrics(
          organizationId,
          dateRange
        );
        break;
        
      case 'all':
      default:
        // Get all advanced metrics
        const allCohortOptions = {
          timeUnit: 'month',
          metrics: ['retention', 'revenue'],
          cohorts: 6,
          periods: 6
        };
        
        responseData = {
          // Revenue metrics
          revenueData: await AnalyticsService.getMrrChartData(
            organizationId,
            dateRange,
            'month'
          ),
          revenueForecast: await generateRevenueForecast(
            organizationId,
            dateRange
          ),
          
          // Customer metrics
          cohortAnalysis: await AnalyticsService.getCohortAnalysis(
            organizationId,
            allCohortOptions
          ),
          customerMetrics: await getCustomerMetrics(
            organizationId,
            dateRange
          ),
          
          // Subscription metrics
          subscriptionData: await getSubscriptionMetrics(
            organizationId,
            dateRange
          ),
          
          // Product metrics
          productMetrics: await getProductMetrics(
            organizationId,
            dateRange
          )
        };
    }

    // Handle CSV export
    if (format === 'csv') {
      const csv = await AnalyticsService.exportAnalyticsData(
        organizationId,
        type as any,
        dateRange
      );
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-analytics.csv"`
        }
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching advanced analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advanced analytics data' },
      { status: 500 }
    );
  }
}

/**
 * Generate revenue forecast based on historical data
 */
async function generateRevenueForecast(
  organizationId: string,
  dateRange: DateRange
): Promise<any[]> {
  try {
    // This is a placeholder implementation
    // A real implementation would analyze historical subscription and revenue data,
    // accounting for churn rates, new customer acquisition, and potential upgrades
    
    const currentMonth = new Date().getMonth();
    const monthlyData = [];
    
    for (let i = 0; i < 12; i++) {
      const month = new Date();
      month.setMonth(currentMonth + i);
      
      // Generate some sample forecasting data with increasing uncertainty
      const baseValue = 10000 + (i * 500);
      const randomVariation = Math.random() * 1000 - 500;
      const predicted = Math.max(0, baseValue + randomVariation);
      const uncertainty = 1000 + (i * 100); // Uncertainty grows over time
      
      monthlyData.push({
        month: month.toISOString().substring(0, 7),
        predicted: Math.round(predicted),
        upperBound: Math.round(predicted + uncertainty),
        lowerBound: Math.round(Math.max(0, predicted - uncertainty))
      });
    }
    
    return monthlyData;
  } catch (error) {
    console.error('Error generating revenue forecast:', error);
    return [];
  }
}

/**
 * Get detailed customer metrics
 */
async function getCustomerMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<any> {
  try {
    // A real implementation would calculate actual metrics from the database
    
    // For now, return sample data
    return {
      acquisitionCost: 125.50, // CAC - Customer Acquisition Cost
      lifetimeValue: 580.75,   // LTV - Lifetime Value
      acquisitionChannels: [
        { channel: 'Organic Search', percentage: 35 },
        { channel: 'Referral', percentage: 25 },
        { channel: 'Social Media', percentage: 20 },
        { channel: 'Paid Advertising', percentage: 15 },
        { channel: 'Other', percentage: 5 }
      ],
      segmentation: {
        byPlan: [
          { segment: 'Basic', percentage: 45 },
          { segment: 'Pro', percentage: 35 },
          { segment: 'Enterprise', percentage: 20 }
        ],
        byIndustry: [
          { segment: 'Technology', percentage: 30 },
          { segment: 'Finance', percentage: 25 },
          { segment: 'Healthcare', percentage: 20 },
          { segment: 'Education', percentage: 15 },
          { segment: 'Other', percentage: 10 }
        ]
      },
      churnRate: 3.2, // Monthly churn rate percentage
      retentionRate: 96.8, // Monthly retention rate percentage
      netPromoterScore: 42 // NPS
    };
  } catch (error) {
    console.error('Error calculating customer metrics:', error);
    return {};
  }
}

/**
 * Get subscription metrics and trends
 */
async function getSubscriptionMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<any> {
  try {
    // A real implementation would calculate metrics from subscription data
    
    // Return sample data
    return {
      summary: {
        totalSubscriptions: 485,
        activeSubscriptions: 450,
        churnedSubscriptions: 35,
        trialSubscriptions: 65,
        paused: 15
      },
      metrics: {
        churnRate: 3.5, // Monthly percentage
        conversionRate: 28.7, // Trial to paid conversion percentage
        averageSubscriptionLength: 9.2, // months
        mrr: 32500, // Monthly Recurring Revenue
        arr: 390000, // Annual Recurring Revenue
        monthlyGrowth: 4.7 // percentage
      },
      distribution: {
        byPlan: [
          { name: 'Basic', count: 245, percentage: 50.4, mrr: 9800 },
          { name: 'Pro', count: 183, percentage: 37.6, mrr: 14640 },
          { name: 'Enterprise', count: 57, percentage: 12.0, mrr: 8550 }
        ],
        byBillingCycle: [
          { cycle: 'Monthly', count: 325, percentage: 67 },
          { cycle: 'Annual', count: 160, percentage: 33 }
        ]
      },
      trends: {
        upgrades: 28,
        downgrades: 12,
        expansionRevenue: 2800, // Additional revenue from upgrades
        contractionRevenue: 1200 // Lost revenue from downgrades
      }
    };
  } catch (error) {
    console.error('Error calculating subscription metrics:', error);
    return {};
  }
}

/**
 * Get product performance metrics
 */
async function getProductMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<any> {
  try {
    // A real implementation would analyze product usage and revenue
    
    // Return sample data
    return {
      popularProducts: [
        { id: 'prod1', name: 'Basic Plan', count: 245, percentage: 50.4 },
        { id: 'prod2', name: 'Pro Plan', count: 183, percentage: 37.6 },
        { id: 'prod3', name: 'Enterprise Plan', count: 57, percentage: 12.0 }
      ],
      revenueByProduct: [
        { id: 'prod1', name: 'Basic Plan', revenue: 9800, percentage: 30.1 },
        { id: 'prod2', name: 'Pro Plan', revenue: 14640, percentage: 45.0 },
        { id: 'prod3', name: 'Enterprise Plan', revenue: 8550, percentage: 24.9 }
      ],
      growthByProduct: {
        'Basic Plan': 4.2,
        'Pro Plan': 8.7,
        'Enterprise Plan': 12.5
      },
      features: {
        mostUsed: [
          { feature: 'Invoice Generation', usageCount: 1245 },
          { feature: 'Payment Processing', usageCount: 980 },
          { feature: 'Analytics', usageCount: 765 },
          { feature: 'Customer Management', usageCount: 612 }
        ],
        leastUsed: [
          { feature: 'API Access', usageCount: 87 },
          { feature: 'Custom Branding', usageCount: 124 },
          { feature: 'Advanced Reports', usageCount: 156 }
        ]
      }
    };
  } catch (error) {
    console.error('Error calculating product metrics:', error);
    return {};
  }
} 