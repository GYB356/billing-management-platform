import { dataAggregator } from './dataAggregator';
import { formatBytes, formatTime } from '@/utils/format';

interface ExportOptions {
  format: 'csv' | 'json';
  period: 'hour' | 'day' | 'week' | 'month';
  includeSummary?: boolean;
}

export class AggregatedMetricsExporter {
  static async exportMetrics(options: ExportOptions): Promise<void> {
    const { format, period, includeSummary = true } = options;
    const metrics = dataAggregator.getAggregatedMetrics(period);
    const summary = includeSummary ? dataAggregator.getMetricsSummary() : null;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      content = this.generateCSV(metrics, summary);
      filename = `i18n_metrics_${period}_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    } else {
      content = this.generateJSON(metrics, summary);
      filename = `i18n_metrics_${period}_${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static generateCSV(metrics: any[], summary: any | null): string {
    const headers = [
      'Timestamp',
      'Total Translations',
      'Success Rate',
      'Cache Hit Rate',
      'Retry Rate',
      'Average Load Time',
      'Memory Usage',
      'Total Size'
    ];

    const rows = metrics.map(metric => [
      new Date(metric.timestamp).toISOString(),
      metric.metrics.totalTranslations,
      `${(metric.metrics.successRate * 100).toFixed(1)}%`,
      `${(metric.metrics.cacheHitRate * 100).toFixed(1)}%`,
      metric.metrics.retryRate.toFixed(1),
      formatTime(metric.metrics.averageLoadTime),
      formatBytes(metric.metrics.memoryUsage),
      formatBytes(metric.metrics.totalSize)
    ]);

    let csv = headers.join(',') + '\n';
    csv += rows.map(row => row.join(',')).join('\n');

    if (summary) {
      csv += '\n\nSummary\n';
      csv += `Total Storage,${summary.totalSize}\n`;
      csv += `Metrics Count,${summary.metricsCount}\n`;
      csv += `Oldest Data,${summary.oldestData.toISOString()}\n`;
      csv += `Newest Data,${summary.newestData.toISOString()}\n`;
    }

    return csv;
  }

  private static generateJSON(metrics: any[], summary: any | null): string {
    const data = {
      metrics: metrics.map(metric => ({
        timestamp: new Date(metric.timestamp).toISOString(),
        period: metric.period,
        metrics: {
          totalTranslations: metric.metrics.totalTranslations,
          successRate: metric.metrics.successRate,
          cacheHitRate: metric.metrics.cacheHitRate,
          retryRate: metric.metrics.retryRate,
          averageLoadTime: metric.metrics.averageLoadTime,
          memoryUsage: metric.metrics.memoryUsage,
          totalSize: metric.metrics.totalSize
        }
      })),
      summary: summary ? {
        totalSize: summary.totalSize,
        metricsCount: summary.metricsCount,
        oldestData: summary.oldestData.toISOString(),
        newestData: summary.newestData.toISOString()
      } : null
    };

    return JSON.stringify(data, null, 2);
  }
} 