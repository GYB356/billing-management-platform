# i18n Performance Monitoring System

## Overview
The i18n Performance Monitoring System provides comprehensive monitoring and analytics for translation loading, caching, and warming operations. It includes real-time metrics tracking, performance alerts, and data visualization capabilities.

## Components

### 1. WarmingAnalytics
The main dashboard component that displays performance metrics and alerts.

```tsx
import { WarmingAnalytics } from '@/components/i18n/WarmingAnalytics';

// Usage
<WarmingAnalytics />
```

### 2. Performance Alerts
The alert system monitors various metrics and triggers alerts when thresholds are exceeded.

```typescript
import { performanceAlerts } from '@/utils/i18n/performanceAlerts';

// Configure custom thresholds
performanceAlerts.setThresholds([
  {
    metric: 'successfulWarms',
    operator: '<',
    value: 0.8,
    severity: 'warning',
    message: 'Low success rate detected'
  }
]);

// Check metrics and get alerts
const alerts = performanceAlerts.checkMetrics(metrics);
```

### 3. Metrics Export
Export performance metrics in various formats for analysis.

```typescript
import { exportMetrics, downloadMetrics } from '@/utils/i18n/metricsExport';

// Export as JSON
const jsonData = exportMetrics(metrics, { format: 'json' });

// Export as CSV
const csvData = exportMetrics(metrics, { format: 'csv' });

// Download metrics
downloadMetrics(metrics, { format: 'json' });
```

## Metrics

### Translation Metrics
- `totalTranslations`: Total number of translations
- `successfulWarms`: Number of successful cache warms
- `failedWarms`: Number of failed cache warms
- `cacheHits`: Number of cache hits
- `cacheMisses`: Number of cache misses
- `retryCount`: Number of retry attempts

### Performance Metrics
- `averageLoadTime`: Average time to load translations (ms)
- `totalSize`: Total size of cached translations (bytes)
- `memoryUsage`: Current memory usage (bytes)

## Default Alert Thresholds

| Metric | Operator | Value | Severity |
|--------|----------|--------|----------|
| successfulWarms | < | 0.8 | warning |
| cacheHits | < | 0.6 | warning |
| averageLoadTime | > | 1000 | warning |
| memoryUsage | > | 50MB | error |

## Best Practices

1. **Monitoring Setup**
   - Place the `WarmingAnalytics` component in your admin dashboard
   - Configure alert thresholds based on your application's requirements
   - Set up regular metric exports for historical analysis

2. **Performance Optimization**
   - Monitor cache hit rates to optimize warming strategies
   - Track memory usage to prevent excessive cache growth
   - Use the export feature to analyze performance trends

3. **Alert Management**
   - Review and adjust alert thresholds regularly
   - Set up notifications for critical alerts
   - Monitor alert patterns to identify systemic issues

## API Reference

### WarmingAnalytics Component
```typescript
interface WarmingAnalyticsProps {
  refreshInterval?: number; // Default: 5000ms
  showCharts?: boolean;    // Default: true
  showAlerts?: boolean;    // Default: true
}
```

### Performance Alerts
```typescript
interface AlertThreshold {
  metric: keyof WarmingMetrics;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
  severity: 'warning' | 'error';
  message: string;
}
```

### Metrics Export
```typescript
interface ExportOptions {
  format: 'csv' | 'json';
  includeHistoricalData?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check cache size limits
   - Review warming strategies
   - Consider implementing cache eviction policies

2. **Low Cache Hit Rate**
   - Verify warming schedule
   - Check translation update frequency
   - Review cache invalidation logic

3. **Slow Load Times**
   - Monitor network performance
   - Check bundle sizes
   - Review translation chunking strategy

## Contributing

When contributing to the performance monitoring system:

1. Add tests for new features
2. Update documentation for API changes
3. Follow the existing code style
4. Include performance impact analysis

## License

MIT License - See LICENSE file for details 