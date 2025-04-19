import { syncStripeSubscriptions } from './sync-stripe-subscriptions';

export async function runCronJobs() {
    while (true) {
        try {
            await syncStripeSubscriptions();
            console.log('Stripe subscriptions synced successfully.');
        } catch (error) {
            console.error('Error syncing Stripe subscriptions:', error);
        }
        await new Promise((resolve) => setTimeout(resolve, 60 * 60 * 1000)); // Wait for 1 hour
    }
}