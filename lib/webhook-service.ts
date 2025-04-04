import crypto from 'crypto';
import { prisma } from './prisma';
import { createEvent, EventSeverity } from './events';

export interface WebhookPayload {
  id: string;
  event: string;
  createdAt: string;
  data: any;
}

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretKey: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookEndpointId: string;
  event: string;
  payload: WebhookPayload;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  statusCode?: number;
  response?: string;
  errorMessage?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookService {
  /**
   * Create a new webhook endpoint
   */
  static async createWebhookEndpoint(data: {
    organizationId: string;
    name: string;
    url: string;
    events: string[];
    isActive?: boolean;
    metadata?: Record<string, any>;
  }): Promise<WebhookEndpoint> {
    // Generate secret key
    const secretKey = this.generateSecretKey();

    // Create webhook endpoint in database
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive ?? true,
        secretKey,
        metadata: data.metadata || {},
      },
    });

    // Log creation event
    await createEvent({
      organizationId: data.organizationId,
      eventType: 'WEBHOOK_ENDPOINT_CREATED',
      resourceType: 'WEBHOOK_ENDPOINT',
      resourceId: endpoint.id,
      severity: EventSeverity.INFO,
      metadata: {
        name: data.name,
        url: data.url,
        events: data.events,
      },
    });

    return {
      id: endpoint.id,
      organizationId: endpoint.organizationId,
      name: endpoint.name,
      url: endpoint.url,
      events: endpoint.events as string[],
      isActive: endpoint.isActive,
      secretKey: endpoint.secretKey,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
      metadata: endpoint.metadata as Record<string, any>,
    };
  }

  /**
   * Update a webhook endpoint
   */
  static async updateWebhookEndpoint(
    id: string,
    data: {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<WebhookEndpoint> {
    // Get current endpoint to check permissions
    const currentEndpoint = await prisma.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!currentEndpoint) {
      throw new Error(`Webhook endpoint with ID ${id} not found`);
    }

    // Update webhook endpoint
    const updatedEndpoint = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
        metadata: data.metadata,
      },
    });

    // Log update event
    await createEvent({
      organizationId: updatedEndpoint.organizationId,
      eventType: 'WEBHOOK_ENDPOINT_UPDATED',
      resourceType: 'WEBHOOK_ENDPOINT',
      resourceId: updatedEndpoint.id,
      severity: EventSeverity.INFO,
      metadata: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
      },
    });

    return {
      id: updatedEndpoint.id,
      organizationId: updatedEndpoint.organizationId,
      name: updatedEndpoint.name,
      url: updatedEndpoint.url,
      events: updatedEndpoint.events as string[],
      isActive: updatedEndpoint.isActive,
      secretKey: updatedEndpoint.secretKey,
      createdAt: updatedEndpoint.createdAt,
      updatedAt: updatedEndpoint.updatedAt,
      metadata: updatedEndpoint.metadata as Record<string, any>,
    };
  }

  /**
   * Delete a webhook endpoint
   */
  static async deleteWebhookEndpoint(id: string): Promise<boolean> {
    // Get current endpoint to check permissions and log deletion
    const currentEndpoint = await prisma.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!currentEndpoint) {
      throw new Error(`Webhook endpoint with ID ${id} not found`);
    }

    // Delete webhook endpoint
    await prisma.webhookEndpoint.delete({
      where: { id },
    });

    // Log deletion event
    await createEvent({
      organizationId: currentEndpoint.organizationId,
      eventType: 'WEBHOOK_ENDPOINT_DELETED',
      resourceType: 'WEBHOOK_ENDPOINT',
      resourceId: id,
      severity: EventSeverity.INFO,
      metadata: {
        name: currentEndpoint.name,
        url: currentEndpoint.url,
      },
    });

    return true;
  }

  /**
   * Regenerate webhook secret key
   */
  static async regenerateSecretKey(id: string): Promise<string> {
    // Get current endpoint to check permissions
    const currentEndpoint = await prisma.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!currentEndpoint) {
      throw new Error(`Webhook endpoint with ID ${id} not found`);
    }

    // Generate new secret key
    const secretKey = this.generateSecretKey();

    // Update webhook endpoint
    await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        secretKey,
      },
    });

    // Log key regeneration event
    await createEvent({
      organizationId: currentEndpoint.organizationId,
      eventType: 'WEBHOOK_SECRET_REGENERATED',
      resourceType: 'WEBHOOK_ENDPOINT',
      resourceId: id,
      severity: EventSeverity.INFO,
      metadata: {
        name: currentEndpoint.name,
        url: currentEndpoint.url,
      },
    });

    return secretKey;
  }

  /**
   * Trigger a webhook event
   */
  static async triggerWebhook(eventName: string, data: any): Promise<void> {
    // Find all active webhook endpoints subscribed to this event
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        events: {
          has: eventName,
        },
      },
    });

    if (endpoints.length === 0) {
      // No endpoints to notify
      return;
    }

    // Create webhook payload
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      event: eventName,
      createdAt: new Date().toISOString(),
      data,
    };

    // Send webhook to all endpoints
    for (const endpoint of endpoints) {
      await this.sendWebhook(endpoint, payload);
    }
  }

  /**
   * Send a webhook to a specific endpoint
   * @private
   */
  private static async sendWebhook(
    endpoint: any,
    payload: WebhookPayload
  ): Promise<void> {
    // Create delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: endpoint.id,
        event: payload.event,
        payload,
        status: 'PENDING',
        attempts: 0,
      },
    });

    try {
      // Generate signature
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(
        endpoint.secretKey,
        timestamp,
        JSON.stringify(payload)
      );

      // Send HTTP request to endpoint
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': payload.event,
        },
        body: JSON.stringify(payload),
      });

      // Store response
      const responseText = await response.text();
      const success = response.status >= 200 && response.status < 300;

      // Update delivery record
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          statusCode: response.status,
          response: responseText.substring(0, 1000), // Limit response length
          attempts: 1,
          updatedAt: new Date(),
        },
      });

      // Log delivery result
      await createEvent({
        organizationId: endpoint.organizationId,
        eventType: success ? 'WEBHOOK_DELIVERY_SUCCESS' : 'WEBHOOK_DELIVERY_FAILED',
        resourceType: 'WEBHOOK_DELIVERY',
        resourceId: delivery.id,
        severity: success ? EventSeverity.INFO : EventSeverity.WARNING,
        metadata: {
          webhookEndpointId: endpoint.id,
          event: payload.event,
          url: endpoint.url,
          statusCode: response.status,
        },
      });
    } catch (error) {
      // Update delivery record with error
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          attempts: 1,
          updatedAt: new Date(),
        },
      });

      // Log delivery error
      await createEvent({
        organizationId: endpoint.organizationId,
        eventType: 'WEBHOOK_DELIVERY_ERROR',
        resourceType: 'WEBHOOK_DELIVERY',
        resourceId: delivery.id,
        severity: EventSeverity.ERROR,
        metadata: {
          webhookEndpointId: endpoint.id,
          event: payload.event,
          url: endpoint.url,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Retry a failed webhook delivery
   */
  static async retryWebhookDelivery(id: string): Promise<boolean> {
    // Get delivery record
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id },
      include: {
        webhookEndpoint: true,
      },
    });

    if (!delivery) {
      throw new Error(`Webhook delivery with ID ${id} not found`);
    }

    if (delivery.status === 'SUCCESS') {
      throw new Error('Cannot retry a successful webhook delivery');
    }

    if (!delivery.webhookEndpoint.isActive) {
      throw new Error('Cannot retry delivery to an inactive webhook endpoint');
    }

    try {
      // Generate signature
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(
        delivery.webhookEndpoint.secretKey,
        timestamp,
        JSON.stringify(delivery.payload)
      );

      // Send HTTP request to endpoint
      const response = await fetch(delivery.webhookEndpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Retry': 'true',
        },
        body: JSON.stringify(delivery.payload),
      });

      // Store response
      const responseText = await response.text();
      const success = response.status >= 200 && response.status < 300;

      // Update delivery record
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          statusCode: response.status,
          response: responseText.substring(0, 1000), // Limit response length
          attempts: delivery.attempts + 1,
          updatedAt: new Date(),
        },
      });

      // Log retry result
      await createEvent({
        organizationId: delivery.webhookEndpoint.organizationId,
        eventType: success ? 'WEBHOOK_RETRY_SUCCESS' : 'WEBHOOK_RETRY_FAILED',
        resourceType: 'WEBHOOK_DELIVERY',
        resourceId: delivery.id,
        severity: success ? EventSeverity.INFO : EventSeverity.WARNING,
        metadata: {
          webhookEndpointId: delivery.webhookEndpoint.id,
          event: delivery.event,
          url: delivery.webhookEndpoint.url,
          statusCode: response.status,
          attempt: delivery.attempts + 1,
        },
      });

      return success;
    } catch (error) {
      // Update delivery record with error
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          attempts: delivery.attempts + 1,
          updatedAt: new Date(),
        },
      });

      // Log retry error
      await createEvent({
        organizationId: delivery.webhookEndpoint.organizationId,
        eventType: 'WEBHOOK_RETRY_ERROR',
        resourceType: 'WEBHOOK_DELIVERY',
        resourceId: delivery.id,
        severity: EventSeverity.ERROR,
        metadata: {
          webhookEndpointId: delivery.webhookEndpoint.id,
          event: delivery.event,
          url: delivery.webhookEndpoint.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: delivery.attempts + 1,
        },
      });

      return false;
    }
  }

  /**
   * Get webhook events eligible for subscription
   */
  static getAvailableWebhookEvents(): string[] {
    return [
      // Subscription events
      'subscription.created',
      'subscription.updated',
      'subscription.cancelled',
      'subscription.trial_ending',
      'subscription.trial_ended',
      
      // Invoice events
      'invoice.created',
      'invoice.paid',
      'invoice.payment_failed',
      
      // Customer events
      'customer.created',
      'customer.updated',
      
      // Payment events
      'payment.succeeded',
      'payment.failed',
      'payment.refunded',
      
      // Usage events
      'usage.recorded',
      'usage.threshold_exceeded',
    ];
  }

  /**
   * Generate a secure random secret key
   * @private
   */
  private static generateSecretKey(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Generate signature for webhook payload
   * @private
   */
  private static generateSignature(
    secretKey: string,
    timestamp: string,
    payload: string
  ): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(signedPayload)
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    signature: string,
    secretKey: string,
    body: string
  ): boolean {
    try {
      // Parse signature components
      const [timestampPart, signaturePart] = signature.split(',');
      const timestamp = timestampPart.split('=')[1];
      const receivedSignature = signaturePart.split('=')[1];
      
      // Check timestamp is not too old (10 min)
      const timestampNum = parseInt(timestamp, 10);
      if (Date.now() - timestampNum > 10 * 60 * 1000) {
        return false;
      }
      
      // Generate expected signature
      const signedPayload = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(signedPayload)
        .digest('hex');
      
      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
} 