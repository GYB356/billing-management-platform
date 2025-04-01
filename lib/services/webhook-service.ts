import prisma from '@/lib/prisma';
import axios from 'axios';
import crypto from 'crypto';

// Types
export enum WebhookEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  USAGE_LIMIT_EXCEEDED = 'usage.limit_exceeded',
  USAGE_THRESHOLD_REACHED = 'usage.threshold_reached',
  CREDIT_ADDED = 'credit.added',
  CREDIT_DEDUCTED = 'credit.deducted',
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_PROCESSED = 'refund.processed',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  TAX_RATE_CHANGED = 'tax.rate_changed',
  BILLING_PERIOD_STARTED = 'billing.period_started',
  BILLING_PERIOD_ENDED = 'billing.period_ended',
  WEBHOOK_ENDPOINT_CREATED = 'webhook.endpoint.created',
  WEBHOOK_ENDPOINT_UPDATED = 'webhook.endpoint.updated',
  WEBHOOK_ENDPOINT_DELETED = 'webhook.endpoint.deleted'
}

export interface WebhookPayload {
  id: string;
  timestamp: string;
  type: WebhookEventType;
  data: any;
}

/**
 * Creates a webhook endpoint for an organization
 */
export async function createWebhookEndpoint(
  organizationId: string,
  url: string,
  secret: string,
  description: string,
  eventTypes: WebhookEventType[],
  isActive = true
) {
  // Check if the organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    throw new Error('Invalid webhook URL format');
  }

  // Create the webhook endpoint
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId,
      url,
      secret,
      description,
      eventTypes,
      isActive,
    },
  });

  return endpoint;
}

/**
 * Updates a webhook endpoint
 */
export async function updateWebhookEndpoint(
  endpointId: string,
  data: {
    url?: string;
    secret?: string;
    description?: string;
    eventTypes?: WebhookEventType[];
    isActive?: boolean;
  }
) {
  // Check if the endpoint exists
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) {
    throw new Error('Webhook endpoint not found');
  }

  // Validate URL format if provided
  if (data.url) {
    try {
      new URL(data.url);
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }
  }

  // Update the endpoint
  const updatedEndpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data,
  });

  return updatedEndpoint;
}

/**
 * Deletes a webhook endpoint
 */
export async function deleteWebhookEndpoint(endpointId: string) {
  // Check if the endpoint exists
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) {
    throw new Error('Webhook endpoint not found');
  }

  // Delete the endpoint
  await prisma.webhookEndpoint.delete({
    where: { id: endpointId },
  });

  return true;
}

/**
 * Gets all webhook endpoints for an organization
 */
export async function getWebhookEndpoints(
  organizationId: string,
  options?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const { isActive, limit = 100, offset = 0 } = options || {};

  // Build the where clause
  const where: any = { organizationId };

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  // Get the endpoints
  const [endpoints, total] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.webhookEndpoint.count({ where }),
  ]);

  return {
    data: endpoints,
    meta: {
      total,
      limit,
      offset,
    },
  };
}

/**
 * Delivers an event to all webhook endpoints that subscribe to that event type
 */
export async function deliverWebhook(
  organizationId: string,
  eventType: WebhookEventType,
  data: any
) {
  // Get all active webhook endpoints for this organization that subscribe to this event type
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organizationId,
      isActive: true,
      eventTypes: {
        has: eventType,
      },
    },
  });

  if (!endpoints.length) {
    return { sent: 0, failed: 0 };
  }

  // Create the webhook payload
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: eventType,
    data,
  };

  const deliveryPromises = endpoints.map(async (endpoint) => {
    let deliveryId: string | undefined;
    
    try {
      // Create a delivery record
      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: endpoint.id,
          eventType,
          payload,
          status: 'PENDING',
        },
      });
      
      deliveryId = delivery.id;

      // Sign the payload using the endpoint's secret
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Send the webhook
      const response = await axios.post(
        endpoint.url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Webhook-ID': delivery.id,
            'X-Webhook-Event-Type': eventType,
            'X-Webhook-Timestamp': payload.timestamp,
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      // Update the delivery record
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'DELIVERED',
          statusCode: response.status,
          response: response.data,
        },
      });

      return true;
    } catch (error: any) {
      console.error(`Webhook delivery failed to ${endpoint.url}:`, error.message);
      
      // Only update if we have a delivery ID
      if (deliveryId) {
        // Update the delivery record with the error
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'FAILED',
            statusCode: error.response?.status,
            response: {
              error: error.message,
              details: error.response?.data || null
            },
          },
        });
      }

      return false;
    }
  });

  // Wait for all deliveries to complete
  const results = await Promise.allSettled(deliveryPromises);
  
  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;

  return { sent, failed };
}

/**
 * Retries a failed webhook delivery
 */
export async function retryWebhookDelivery(deliveryId: string) {
  // Get the delivery
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhookEndpoint: true,
    },
  });

  if (!delivery) {
    throw new Error('Webhook delivery not found');
  }

  if (delivery.status === 'DELIVERED') {
    throw new Error('Cannot retry a successfully delivered webhook');
  }

  if (!delivery.webhookEndpoint.isActive) {
    throw new Error('Cannot retry a webhook to an inactive endpoint');
  }

  // Check if we've exceeded maximum retry attempts (5)
  if (delivery.retryCount >= 5) {
    throw new Error('Maximum retry attempts exceeded');
  }

  try {
    // Sign the payload using the endpoint's secret
    const signature = crypto
      .createHmac('sha256', delivery.webhookEndpoint.secret)
      .update(JSON.stringify(delivery.payload))
      .digest('hex');

    // Send the webhook
    const response = await axios.post(
      delivery.webhookEndpoint.url,
      delivery.payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event-Type': (delivery.payload as any).type,
          'X-Webhook-Timestamp': (delivery.payload as any).timestamp,
          'X-Webhook-Retry-Count': (delivery.retryCount + 1).toString(),
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    // Update the delivery record
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        statusCode: response.status,
        response: response.data,
        retryCount: delivery.retryCount + 1,
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (error: any) {
    console.error(`Webhook retry failed for delivery ${deliveryId}:`, error.message);
    
    // Update the delivery record with the error
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        statusCode: error.response?.status,
        response: {
          error: error.message,
          details: error.response?.data || null
        },
        retryCount: delivery.retryCount + 1,
        updatedAt: new Date(),
      },
    });

    return false;
  }
}

/**
 * Gets webhook delivery history for an organization's endpoint
 */
export async function getWebhookDeliveries(
  endpointId: string,
  options?: {
    status?: 'PENDING' | 'DELIVERED' | 'FAILED';
    eventType?: WebhookEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const { status, eventType, startDate, endDate, limit = 100, offset = 0 } = options || {};

  // Build the where clause
  const where: any = { webhookEndpointId: endpointId };

  if (status) {
    where.status = status;
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  // Get the deliveries
  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  return {
    data: deliveries,
    meta: {
      total,
      limit,
      offset,
    },
  };
}

/**
 * Returns a list of all available webhook event types
 */
export function getAvailableWebhookEventTypes(): string[] {
  return Object.values(WebhookEventType);
}

/**
 * Validates a webhook signature
 */
export function validateWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
} 