// Webhook delivery system with retries

import axios from 'axios';

interface WebhookPayload {
  url: string;
  data: any;
}

class WebhookDelivery {
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxRetries: number = 3, retryDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async deliver(payload: WebhookPayload): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        await axios.post(payload.url, payload.data);
        console.log(`Webhook delivered successfully to ${payload.url}`);
        return;
      } catch (error) {
        attempts++;
        console.error(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts < this.maxRetries) {
          await this.delay(this.retryDelay);
        } else {
          console.error(`Failed to deliver webhook to ${payload.url} after ${this.maxRetries} attempts`);
          throw error;
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default WebhookDelivery;