import { prisma } from '../prisma';

export interface MetricPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Create a new metric data point
 */
export async function createMetric(
  type: string,
  value: number,
  metadata: Record<string, any> = {}
) {
  return prisma.metricData.create({
    data: {
      type,
      value,
      metadata,
    },
  });
}

/**
 * Get metric data points for a specific type and time range
 */
export async function getMetrics(
  type: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
    metadata?: Record<string, any>;
  } = {}
) {
  const {
    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to last 24 hours
    endDate = new Date(),
    interval = 'hour',
    metadata = {},
  } = options;

  // Build metadata filter
  const metadataFilter = Object.entries(metadata).reduce((acc, [key, value]) => {
    acc[`metadata.${key}`] = value;
    return acc;
  }, {} as Record<string, any>);

  // Get raw data points
  const dataPoints = await prisma.metricData.findMany({
    where: {
      type,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
      ...metadataFilter,
    },
    orderBy: {
      timestamp: 'asc',
    },
  });

  // Group by interval if specified
  if (interval) {
    return groupMetricsByInterval(dataPoints, interval);
  }

  return dataPoints;
}

/**
 * Get aggregated statistics for a metric type
 */
export async function getMetricStats(
  type: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    metadata?: Record<string, any>;
  } = {}
) {
  const {
    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate = new Date(),
    metadata = {},
  } = options;

  // Build metadata filter
  const metadataFilter = Object.entries(metadata).reduce((acc, [key, value]) => {
    acc[`metadata.${key}`] = value;
    return acc;
  }, {} as Record<string, any>);

  const stats = await prisma.metricData.aggregate({
    where: {
      type,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
      ...metadataFilter,
    },
    _count: true,
    _sum: {
      value: true,
    },
    _avg: {
      value: true,
    },
    _min: {
      value: true,
    },
    _max: {
      value: true,
    },
  });

  return {
    count: stats._count,
    sum: stats._sum.value || 0,
    average: stats._avg.value || 0,
    min: stats._min.value || 0,
    max: stats._max.value || 0,
  };
}

/**
 * Get the latest value for a metric type
 */
export async function getLatestMetric(
  type: string,
  metadata: Record<string, any> = {}
) {
  // Build metadata filter
  const metadataFilter = Object.entries(metadata).reduce((acc, [key, value]) => {
    acc[`metadata.${key}`] = value;
    return acc;
  }, {} as Record<string, any>);

  return prisma.metricData.findFirst({
    where: {
      type,
      ...metadataFilter,
    },
    orderBy: {
      timestamp: 'desc',
    },
  });
}

/**
 * Group metric data points by time interval
 */
function groupMetricsByInterval(
  dataPoints: MetricPoint[],
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month'
): MetricPoint[] {
  const groups = new Map<string, MetricPoint[]>();

  for (const point of dataPoints) {
    const timestamp = point.timestamp;
    let key: string;

    switch (interval) {
      case 'minute':
        key = timestamp.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
        break;
      case 'hour':
        key = timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        break;
      case 'day':
        key = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
        break;
      case 'week':
        const weekStart = new Date(timestamp);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().slice(0, 10);
        break;
      case 'month':
        key = timestamp.toISOString().slice(0, 7); // YYYY-MM
        break;
      default:
        key = timestamp.toISOString();
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(point);
  }

  // Calculate averages for each group
  return Array.from(groups.entries()).map(([key, points]) => {
    const sum = points.reduce((acc, point) => acc + point.value, 0);
    const average = sum / points.length;

    return {
      timestamp: new Date(key),
      value: average,
      metadata: points[0].metadata, // Use metadata from first point
    };
  });
}

/**
 * Delete old metric data points
 */
export async function cleanupOldMetrics(
  retentionDays: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.metricData.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
} 