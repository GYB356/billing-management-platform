import { CronJob } from 'cron';
import { AdvancedMetricsCollector } from '../metrics/advanced/AdvancedMetricsCollector';

// Collect product metrics daily at 2 AM
new CronJob('0 2 * * *', async () => {
  try {
    await AdvancedMetricsCollector.collectProductMetrics();
  } catch (error) {
    console.error('Error collecting product metrics:', error);
  }
}, null, true);

// Collect customer segment metrics weekly on Mondays at 3 AM
new CronJob('0 3 * * 1', async () => {
  try {
    await AdvancedMetricsCollector.collectCustomerSegmentMetrics();
  } catch (error) {
    console.error('Error collecting customer segment metrics:', error);
  }
}, null, true);

// Collect predictive metrics weekly on Wednesdays at 3 AM
new CronJob('0 3 * * 3', async () => {
  try {
    await AdvancedMetricsCollector.collectPredictiveMetrics();
  } catch (error) {
    console.error('Error collecting predictive metrics:', error);
  }
}, null, true);

// Collect market metrics monthly on the 1st at 4 AM
new CronJob('0 4 1 * *', async () => {
  try {
    await AdvancedMetricsCollector.collectMarketMetrics();
  } catch (error) {
    console.error('Error collecting market metrics:', error);
  }
}, null, true);

// Collect security metrics daily at 1 AM
new CronJob('0 1 * * *', async () => {
  try {
    await AdvancedMetricsCollector.collectSecurityMetrics();
  } catch (error) {
    console.error('Error collecting security metrics:', error);
  }
}, null, true);
