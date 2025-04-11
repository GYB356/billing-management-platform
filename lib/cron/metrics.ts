import { CronJob } from 'cron';
import { metricsCollector } from '@/lib/services/metrics';
import { AdvancedMetricsCollector } from '@/lib/metrics/advanced/AdvancedMetricsCollector';

// Collect basic metrics daily at midnight
new CronJob('0 0 * * *', async () => {
  try {
    await metricsCollector.collectDailyMetrics();
  } catch (error) {
    console.error('Error collecting daily metrics:', error);
  }
}, null, true);

// Collect advanced metrics daily at 1 AM
new CronJob('0 1 * * *', async () => {
  try {
    await AdvancedMetricsCollector.collectUserEngagementMetrics();
    await AdvancedMetricsCollector.collectBusinessMetrics();
  } catch (error) {
    console.error('Error collecting advanced metrics:', error);
  }
}, null, true);

// Collect performance metrics every hour
new CronJob('0 * * * *', async () => {
  try {
    await AdvancedMetricsCollector.collectPerformanceMetrics();
    await AdvancedMetricsCollector.collectInfrastructureMetrics();
  } catch (error) {
    console.error('Error collecting performance metrics:', error);
  }
}, null, true);
