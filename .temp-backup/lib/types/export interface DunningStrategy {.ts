export interface DunningStrategy {
  id: string;
  name: string;
  steps: Array<{
    daysPastDue: number;
    action: 'EMAIL' | 'SMS' | 'SUSPEND' | 'CANCEL';
    template: string;
    retryPayment: boolean;
  }>;
  maxRetries: number;
  gracePeriod: number;
}

// filepath: /lib/services/dunning-service.ts
export class DunningService {
  async handleFailedPayment(
    subscriptionId: string, 
    paymentIntentId: string
  ): Promise<void> {
    // Implement dunning logic
  }
}