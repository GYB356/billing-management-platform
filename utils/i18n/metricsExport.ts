import { WarmingMetrics } from './warmingMetrics';
import { formatBytes, formatTime } from '@/utils/format';

export interface ExportOptions {
  format: 'csv' | 'json';
  includeHistoricalData?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export function exportMetrics(metrics: WarmingMetrics[], options: ExportOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(metrics, null, 2);
  }

  // CSV format
  const headers = [
    'Strategy Priority',
    'Languages',
    'Namespaces',
    'Total Translations',
    'Successful Warms',
    'Failed Warms',
    'Cache Hits',
    'Cache Misses',
    'Retry Count',
    'Average Load Time',
    'Total Size',
    'Memory Usage'
  ];

  const rows = metrics.map(metric => [
    metric.strategyPriority,
    metric.languages.join(';'),
    metric.namespaces.join(';'),
    metric.totalTranslations,
    metric.successfulWarms,
    metric.failedWarms,
    metric.cacheHits,
    metric.cacheMisses,
    metric.retryCount,
    formatTime(metric.averageLoadTime),
    formatBytes(metric.totalSize),
    formatBytes(metric.memoryUsage)
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

export function downloadMetrics(metrics: WarmingMetrics[], options: ExportOptions): void {
  const content = exportMetrics(metrics, options);
  const blob = new Blob([content], { 
    type: options.format === 'json' ? 'application/json' : 'text/csv' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warming-metrics-${new Date().toISOString()}.${options.format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 