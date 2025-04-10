export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretKey: string;
  metadata: Record<string, any>;
}

// filepath: /lib/services/webhook-service.ts
export class WebhookService {
  async dispatchEvent(
    event: string,
    payload: any,
    attempts: number = 0
  ): Promise<void> {
    // Implement webhook dispatch logic
  }
}