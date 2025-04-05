# Quick Start Guide - i18n Performance Monitoring

## Installation

```bash
npm install @i18n/performance-monitoring
# or
yarn add @i18n/performance-monitoring
```

## Basic Setup

1. **Add the Analytics Component**

```tsx
import { WarmingAnalytics } from '@/components/i18n/WarmingAnalytics';

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <WarmingAnalytics />
    </div>
  );
}
```

2. **Configure Alert Thresholds**

```typescript
import { performanceAlerts } from '@/utils/i18n/performanceAlerts';

// Set up custom thresholds
performanceAlerts.setThresholds([
  {
    metric: 'successfulWarms',
    operator: '<',
    value: 0.8,
    severity: 'warning',
    message: 'Low success rate detected'
  }
]);
```

3. **Export Metrics**

```typescript
import { downloadMetrics } from '@/utils/i18n/metricsExport';

// Export metrics as JSON
downloadMetrics(metrics, { format: 'json' });

// Export metrics as CSV
downloadMetrics(metrics, { format: 'csv' });
```

## Common Use Cases

### 1. Monitoring Translation Loading

```typescript
import { warmingMetrics } from '@/utils/i18n/warmingMetrics';

// Track translation load
function loadTranslation(language: string, namespace: string) {
  const startTime = performance.now();
  
  return loadTranslations(language, namespace)
    .then(() => {
      const loadTime = performance.now() - startTime;
      warmingMetrics.trackTranslationLoad(language, namespace, loadTime);
    });
}
```

### 2. Setting Up Alerts

```typescript
// Configure alerts for different scenarios
performanceAlerts.setThresholds([
  // Cache performance
  {
    metric: 'cacheHits',
    operator: '<',
    value: 0.6,
    severity: 'warning',
    message: 'Low cache hit rate detected'
  },
  // Memory usage
  {
    metric: 'memoryUsage',
    operator: '>',
    value: 50 * 1024 * 1024, // 50MB
    severity: 'error',
    message: 'High memory usage detected'
  }
]);
```

### 3. Analyzing Performance Data

```typescript
// Get performance metrics
const metrics = warmingMetrics.getMetrics();

// Calculate success rate
const successRate = metrics.successfulWarms / metrics.totalTranslations;

// Check cache effectiveness
const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);
```

## Best Practices

1. **Regular Monitoring**
   - Check the analytics dashboard daily
   - Review alert patterns weekly
   - Export metrics monthly for trend analysis

2. **Alert Configuration**
   - Start with default thresholds
   - Adjust based on your application's needs
   - Set up notifications for critical alerts

3. **Performance Optimization**
   - Monitor cache hit rates
   - Track memory usage
   - Analyze load times

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```typescript
   // Check current memory usage
   const memoryUsage = warmingMetrics.getMetrics().memoryUsage;
   
   // Clear cache if needed
   if (memoryUsage > 50 * 1024 * 1024) {
     warmingMetrics.clearCache();
   }
   ```

2. **Low Cache Hit Rate**
   ```typescript
   // Analyze cache performance
   const cacheStats = warmingMetrics.getCacheStats();
   
   // Adjust warming strategy if needed
   if (cacheStats.hitRate < 0.6) {
     adjustWarmingStrategy();
   }
   ```

3. **Slow Load Times**
   ```typescript
   // Monitor load times
   const loadTimes = warmingMetrics.getLoadTimes();
   
   // Optimize if needed
   if (loadTimes.average > 1000) {
     optimizeTranslationLoading();
   }
   ```

## Next Steps

1. **Advanced Configuration**
   - Set up custom metric collectors
   - Configure advanced alert conditions
   - Implement custom visualization

2. **Integration**
   - Connect with monitoring systems
   - Set up automated reporting
   - Configure webhook notifications

3. **Optimization**
   - Analyze performance trends
   - Optimize warming strategies
   - Fine-tune cache settings

## Support

For additional help:
- Check the [full documentation](./performance-monitoring.md)
- Review [technical details](./technical-details.md)
- Join our community forum
- Contact support team 