import { prisma } from '@/lib/prisma';
import { createHmac } from 'crypto';

interface WebhookPayload {
  event: string;
  data: any;
  timestamp: number;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'success' | 'failed';
  statusCode?: number;
  response?: string;
  error?: string;
  retries: number;
  createdAt: Date;
}

export class WebhookService {
  // ...rest of the code from the prompt...
}

export const webhookService = WebhookService.getInstance();
