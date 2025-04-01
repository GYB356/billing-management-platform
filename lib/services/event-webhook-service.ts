import { deliverWebhook, WebhookEventType } from './webhook-service';
import prisma from '@/lib/prisma';

/**
 * Maps internal event types to webhook event types
 */
const eventTypeMapping: Record<string, WebhookEventType> = {
  'SUBSCRIPTION_CREATED': WebhookEventType.SUBSCRIPTION_CREATED,
  'SUBSCRIPTION_UPDATED': WebhookEventType.SUBSCRIPTION_UPDATED,
  'SUBSCRIPTION_CANCELED': WebhookEventType.SUBSCRIPTION_CANCELED,
  'SUBSCRIPTION_PAUSED': WebhookEventType.SUBSCRIPTION_PAUSED,
  'SUBSCRIPTION_RESUMED': WebhookEventType.SUBSCRIPTION_RESUMED,
  'INVOICE_CREATED': WebhookEventType.INVOICE_CREATED,
  'INVOICE_PAID': WebhookEventType.INVOICE_PAID,
  'INVOICE_PAYMENT_FAILED': WebhookEventType.INVOICE_PAYMENT_FAILED,
  'USAGE_LIMIT_EXCEEDED': WebhookEventType.USAGE_LIMIT_EXCEEDED,
  'USAGE_THRESHOLD_REACHED': WebhookEventType.USAGE_THRESHOLD_REACHED,
  'CREDIT_ADDED': WebhookEventType.CREDIT_ADDED,
  'CREDIT_DEDUCTED': WebhookEventType.CREDIT_DEDUCTED,
  'PAYMENT_SUCCEEDED': WebhookEventType.PAYMENT_SUCCEEDED,
  'PAYMENT_FAILED': WebhookEventType.PAYMENT_FAILED,
  'REFUND_PROCESSED': WebhookEventType.REFUND_PROCESSED,
  'CUSTOMER_CREATED': WebhookEventType.CUSTOMER_CREATED,
  'CUSTOMER_UPDATED': WebhookEventType.CUSTOMER_UPDATED,
  'TAX_RATE_CHANGED': WebhookEventType.TAX_RATE_CHANGED,
  'BILLING_PERIOD_STARTED': WebhookEventType.BILLING_PERIOD_STARTED,
  'BILLING_PERIOD_ENDED': WebhookEventType.BILLING_PERIOD_ENDED,
  'WEBHOOK_ENDPOINT_CREATED': WebhookEventType.WEBHOOK_ENDPOINT_CREATED,
  'WEBHOOK_ENDPOINT_UPDATED': WebhookEventType.WEBHOOK_ENDPOINT_UPDATED,
  'WEBHOOK_ENDPOINT_DELETED': WebhookEventType.WEBHOOK_ENDPOINT_DELETED
};

/**
 * Processes an event and delivers webhooks if needed
 * This should be called whenever a new event is created
 */
export async function processEventForWebhooks(eventId: string): Promise<void> {
  try {
    // Get the event from the database
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      console.error(`Event not found: ${eventId}`);
      return;
    }

    // Only process events that have an organization ID
    if (!event.organizationId) {
      console.log(`Skipping event ${eventId} - no organization ID`);
      return;
    }

    // Map the event type to a webhook event type
    const webhookEventType = eventTypeMapping[event.eventType];
    if (!webhookEventType) {
      console.log(`No webhook event type mapping for event type: ${event.eventType}`);
      return;
    }

    // Prepare the data to send to the webhook
    const data = {
      id: event.id,
      timestamp: event.timestamp,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      severity: event.severity,
      metadata: event.metadata || {},
    };

    // Deliver the webhook
    await deliverWebhook(event.organizationId, webhookEventType, data);
  } catch (error) {
    console.error('Error processing event for webhooks:', error);
  }
}

/**
 * Registers a webhook handler for all events
 * This should be called during application startup
 */
export function registerWebhookEventHandlers(): void {
  // Register event handlers for webhook processing
  // This is a placeholder for future implementation
  console.log('Webhook event handlers registered');
}

/**
 * Gets webhook-related stats for an organization
 */
export async function getWebhookStats(organizationId: string) {
  // Get webhook endpoint count
  const endpointCount = await prisma.webhookEndpoint.count({
    where: { organizationId }
  });

  // Get delivery statistics
  const deliveryStats = await prisma.webhookDelivery.groupBy({
    by: ['status'],
    where: {
      webhookEndpoint: {
        organizationId
      }
    },
    _count: true
  });

  // Get recent deliveries
  const recentDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      webhookEndpoint: {
        organizationId
      }
    },
    take: 10,
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      eventType: true,
      status: true,
      statusCode: true,
      createdAt: true,
      retryCount: true
    }
  });

  // Format delivery stats
  const formattedDeliveryStats = deliveryStats.reduce((acc, stat) => {
    acc[stat.status.toLowerCase()] = stat._count;
    return acc;
  }, {} as Record<string, number>);

  return {
    endpointCount,
    deliveryStats: formattedDeliveryStats,
    recentDeliveries
  };
}

/**
 * Process multiple events for webhooks in batch
 * Useful for bulk operations
 */
export async function processEventsForWebhooks(eventIds: string[]): Promise<void> {
  await Promise.all(eventIds.map(id => processEventForWebhooks(id)));
}

/**
 * Checks if an organization has active webhook endpoints for a given event type
 */
export async function hasActiveWebhooksForEvent(
  organizationId: string, 
  eventType: string
): Promise<boolean> {
  const webhookEventType = eventTypeMapping[eventType];
  
  if (!webhookEventType) {
    return false;
  }
  
  const count = await prisma.webhookEndpoint.count({
    where: {
      organizationId,
      isActive: true,
      eventTypes: {
        has: webhookEventType
      }
    }
  });
  
  return count > 0;
} 