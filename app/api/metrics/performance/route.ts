import { NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoring-service';
import { i18nMonitor } from '@/utils/i18n/monitoring';
import type { PerformanceMetrics, SystemMetrics, I18nMetrics } from '@/types/monitoring';

/**
 * GET handler for performance metrics endpoint
 * @returns {Promise<NextResponse>} JSON response containing system and i18n metrics
 */
export async function GET(): Promise<NextResponse> {
  try {
    const monitoringService = MonitoringService.getInstance();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get system metrics
    const metrics: PerformanceMetrics = await monitoringService.getPerformanceMetrics({
      startDate: oneHourAgo,
      endDate: now,
    });

    // Get i18n metrics
    const i18nMetrics: I18nMetrics = i18nMonitor.getMetrics();

    // Generate timestamps for the last hour (one point every 5 minutes)
    const timestamps: string[] = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
      return date.toISOString();
    });

    type MetricsResponse = {
      system: {
        cpu: number[];
        memory: number[];
        requests: number[];
        latency: number[];
      };
      i18n: {
        loadTimes: number[];
        cacheHits: number[];
        bundleSize: number[];
        errors: number;
      };
      timestamps: string[];
    };

    // Format response data
    const response: MetricsResponse = {
      system: {
        cpu: [metrics.cpu.usage * 100], // Convert to percentage
        memory: [(metrics.memory.used / metrics.memory.total) * 100], // Convert to percentage
        requests: [metrics.requests.total],
        latency: [metrics.requests.averageLatency],
      },
      i18n: {
        loadTimes: i18nMetrics.translations.map(m => m.loadTime),
        cacheHits: [i18nMetrics.cacheHitRate],
        bundleSize: [i18nMetrics.totalBundleSize],
        errors: i18nMetrics.translations.filter(m => m.hasError).length,
      },
      timestamps,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch performance metrics:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
} 