import { DunningService } from '../services/dunning-service';
import { PaymentRetryService } from '../services/payment-retry-service';
import { createEvent } from '../events';

export async function processPaymentRecovery() {
  try {
    // Initialize services
    const dunningService = new DunningService();
    const retryService = new PaymentRetryService();

    // Process payment retries
    await retryService.processScheduledRetries();

    // Process dunning for past due invoices
    await dunningService.processDunning();

    // Log successful execution
    await createEvent({
      eventType: 'PAYMENT_RECOVERY_JOB_COMPLETED',
      resourceType: 'SYSTEM',
      resourceId: 'payment-recovery-job',
      metadata: {
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error processing payment recovery:', error);
    
    // Log error event
    await createEvent({
      eventType: 'PAYMENT_RECOVERY_JOB_FAILED',
      resourceType: 'SYSTEM',
      resourceId: 'payment-recovery-job',
      severity: 'ERROR',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
}