import cron from 'node-cron';
import { billingSummarizer } from '../services/reporting/billingSummary';
import { getWeeklyBillingActivities } from '../services/db/billingActivities';

// Initialize weekly summary cron job
export function initializeWeeklySummary() {
  // Run every Sunday at midnight (0 0 * * 0)
  cron.schedule('0 0 * * 0', async () => {
    try {
      console.log('Starting weekly billing summary generation...');
      const activities = await getWeeklyBillingActivities();
      await billingSummarizer.sendWeeklySummary(activities);
      console.log('Weekly billing summary sent successfully');
    } catch (error) {
      console.error('Error generating weekly billing summary:', error);
    }
  });
}