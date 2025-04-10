import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for visualization parameters
const visualizationParamsSchema = z.object({
  featureId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// GET endpoint to get usage visualization data
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view subscriptions
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const subscriptionId = params.id;
    
    // Get and validate query parameters
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('featureId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month';
    
    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate and endDate are required parameters' },
        { status: 400 }
      );
    }
    
    const validationResult = visualizationParamsSchema.safeParse({
      featureId,
      startDate: startDateStr,
      endDate: endDateStr,
      groupBy,
    });
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { startDate, endDate } = validationResult.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if the subscription exists and user has access
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: {
                feature: true
              }
            }
          }
        }
      }
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Build the where clause for finding usage records
    const where: any = {
      subscriptionId,
      timestamp: {
        gte: start,
        lte: end
      }
    };
    
    if (featureId) {
      where.featureId = featureId;
    }
    
    // Get all usage records in the date range
    const usageRecords = await prisma.usageRecord.findMany({
      where,
      select: {
        featureId: true,
        quantity: true,
        timestamp: true,
        feature: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true
          }
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });
    
    // Group the records by feature and time period
    const groupedData = groupUsageData(usageRecords, groupBy);
    
    // Format data into time series for visualization
    const timeSeriesData = formatTimeSeriesData(groupedData, start, end, groupBy);
    
    return NextResponse.json(timeSeriesData);
  } catch (error: any) {
    console.error('Error fetching usage visualization data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch usage visualization data' },
      { status: 500 }
    );
  }
}

/**
 * Group usage records by feature and time period
 */
function groupUsageData(
  records: Array<{
    featureId: string;
    quantity: number;
    timestamp: Date;
    feature: {
      id: string;
      name: string;
      code: string;
      unit: string | null;
    };
  }>,
  groupBy: 'day' | 'week' | 'month'
) {
  const grouped: Record<string, Record<string, number>> = {};
  
  for (const record of records) {
    const featureId = record.featureId;
    const featureName = record.feature.name;
    const key = `${featureId}|${featureName}`;
    
    if (!grouped[key]) {
      grouped[key] = {};
    }
    
    // Get the time period key based on groupBy
    const timePeriod = getTimePeriodKey(record.timestamp, groupBy);
    
    if (!grouped[key][timePeriod]) {
      grouped[key][timePeriod] = 0;
    }
    
    grouped[key][timePeriod] += record.quantity;
  }
  
  return grouped;
}

/**
 * Get time period key for grouping
 */
function getTimePeriodKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  if (groupBy === 'day') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } else if (groupBy === 'week') {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Format data into time series for visualization
 */
function formatTimeSeriesData(
  groupedData: Record<string, Record<string, number>>,
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month'
) {
  const timePeriods = generateTimePeriods(startDate, endDate, groupBy);
  const series: Array<{
    featureId: string;
    featureName: string;
    data: Array<{ time: string; value: number }>;
  }> = [];
  
  for (const [featureKey, timePeriodData] of Object.entries(groupedData)) {
    const [featureId, featureName] = featureKey.split('|');
    
    const dataPoints = timePeriods.map(period => ({
      time: period,
      value: timePeriodData[period] || 0
    }));
    
    series.push({
      featureId,
      featureName,
      data: dataPoints
    });
  }
  
  return {
    timePeriods,
    series
  };
}

/**
 * Generate all time periods between start and end dates
 */
function generateTimePeriods(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month'
): string[] {
  const periods: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    periods.push(getTimePeriodKey(current, groupBy));
    
    if (groupBy === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (groupBy === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return periods;
} 