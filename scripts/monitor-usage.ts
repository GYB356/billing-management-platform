import { usageMonitoringService } from '../lib/usage-monitoring';

async function monitorUsage() {
  try {
    console.log('Starting usage monitoring check...');
    
    // Check all active subscriptions for usage thresholds
    await usageMonitoringService.checkAllActiveSubscriptions();
    
    console.log('Usage monitoring check completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in usage monitoring:', error);
    process.exit(1);
  }
}

monitorUsage();