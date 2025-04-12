import { prisma } from '../prisma';
import { createHmac } from 'crypto';
import { setTimeout } from 'timers/promises';

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Signs the payload with the webhook secret
 */
function signPayload(payload: any, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Calculates the next retry delay using exponential backoff
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Delivers a webhook with retries and exponential backoff
 */
export async function deliverWebhook(deliveryId: string) {
  try {
    // Get the webhook delivery and associated webhook
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery || !delivery.webhook) {
      console.error(`Webhook delivery ${deliveryId} not found or webhook missing`);
      return;
    }

    const { webhook, payload, retries } = delivery;
    const { url, secret, retryConfig } = webhook;

    // Parse retry config
    const config: RetryConfig = typeof retryConfig === 'string' 
      ? JSON.parse(retryConfig)
      : retryConfig as RetryConfig;

    // Check if we've exceeded max retries
    if (retries >= config.maxAttempts) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          error: 'Max retry attempts exceeded',
        },
      });
      return;
    }

    // Calculate delay for this attempt
    if (retries > 0) {
      const delay = calculateBackoff(retries, config);
      await setTimeout(delay);
    }

    // Sign the payload
    const signature = signPayload(payload, secret);

    // Attempt delivery
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': deliveryId,
        'User-Agent': 'Billing-Platform-Webhook/1.0',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (response.ok) {
      // Success - update delivery status
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'COMPLETED',
          statusCode: response.status,
          response: responseText,
        },
      });

      // Update webhook last success
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: { lastSuccess: new Date() },
      });
    } else {
      // Failed - retry if we haven't exceeded max attempts
      const nextRetry = retries + 1;
      if (nextRetry < config.maxAttempts) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'PENDING',
            retries: nextRetry,
            statusCode: response.status,
            response: responseText,
            error: `HTTP ${response.status}: ${responseText}`,
          },
        });

        // Schedule next retry
        const delay = calculateBackoff(nextRetry, config);
        setTimeout(() => deliverWebhook(deliveryId), delay);
      } else {
        // Max retries exceeded - mark as failed
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'FAILED',
            statusCode: response.status,
            response: responseText,
            error: `Max retries exceeded. Last error: HTTP ${response.status}: ${responseText}`,
          },
        });

        // Update webhook last failure
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastFailure: new Date() },
        });
      }
    }
  } catch (error) {
    console.error(`Error delivering webhook ${deliveryId}:`, error);

    // Update delivery with error
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Process pending webhook deliveries
 */
export async function processPendingDeliveries() {
  const pendingDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: 'PENDING',
      retries: {
        lt: 3, // Only get deliveries that haven't exceeded max retries
      },
    },
    take: 100, // Process in batches
  });

  // Process deliveries concurrently with limited concurrency
  const concurrency = 5;
  for (let i = 0; i < pendingDeliveries.length; i += concurrency) {
    const batch = pendingDeliveries.slice(i, i + concurrency);
    await Promise.all(batch.map(delivery => deliverWebhook(delivery.id)));
  }
}

/**
 * Start the webhook delivery worker
 */
export function startWebhookWorker(intervalMs = 60000) {
  // Process pending deliveries immediately
  processPendingDeliveries();

  // Then schedule regular processing
  setInterval(processPendingDeliveries, intervalMs);
} 