import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface WebhookPayload {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, any>;
}

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
}

export class WebhookService {
  private readonly defaultTimeout = 10000; // 10 seconds
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 5000, 15000]; // Retry delays in milliseconds

  /**
   * Register a new webhook endpoint
   */
  public async registerWebhook(
    organizationId: string,
    url: string,
    events: string[],
    description?: string,
    metadata: Record<string, any> = {}
  ) {
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid webhook URL');
    }

    // Generate secret
    const secret = this.generateWebhookSecret();

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        organizationId,
        url,
        events,
        description,
        secret,
        metadata,
        active: true
      }
    });

    return {
      ...webhook,
      secret // Only return secret on creation
    };
  }

  /**
   * Send webhook notification
   */
  public async sendWebhook(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    // Find all active webhooks subscribed to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        active: true,
        events: {
          has: eventType
        }
      }
    });

    // Prepare webhook payload
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      type: eventType,
      createdAt: new Date().toISOString(),
      data
    };

    // Send to each webhook endpoint
    const deliveryPromises = webhooks.map(webhook =>
      this.deliverWebhook(webhook, payload)
    );

    await Promise.all(deliveryPromises);
  }

  /**
   * Deliver webhook to endpoint with retries
   */
  private async deliverWebhook(
    webhook: any,
    payload: WebhookPayload
  ): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxRetries) {
      try {
        const result = await this.makeWebhookRequest(webhook, payload);
        
        // Record delivery attempt
        await this.recordDeliveryAttempt(webhook.id, payload.id, {
          success: result.success,
          statusCode: result.statusCode,
          response: result.response,
          error: result.error,
          attemptNumber: attempt + 1
        });

        if (result.success) {
          return;
        }

        lastError = new Error(result.error || 'Webhook delivery failed');
      } catch (error) {
        lastError = error as Error;
        
        // Record failed attempt
        await this.recordDeliveryAttempt(webhook.id, payload.id, {
          success: false,
          error: error.message,
          attemptNumber: attempt + 1
        });
      }

      // Wait before retry
      if (attempt < this.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt]));
      }

      attempt++;
    }

    // If all retries failed, mark webhook as problematic
    if (lastError) {
      await this.handleWebhookFailure(webhook.id);
      throw lastError;
    }
  }

  /**
   * Make actual webhook request
   */
  private async makeWebhookRequest(
    webhook: any,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const signature = this.generateSignature(webhook.secret, JSON.stringify(payload));

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'Billing-Platform-Webhook/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.defaultTimeout)
      });

      const responseText = await response.text();

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        response: responseText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record webhook delivery attempt
   */
  private async recordDeliveryAttempt(
    webhookId: string,
    deliveryId: string,
    result: {
      success: boolean;
      statusCode?: number;
      response?: string;
      error?: string;
      attemptNumber: number;
    }
  ) {
    await prisma.webhookDelivery.create({
      data: {
        id: deliveryId,
        webhookId,
        success: result.success,
        statusCode: result.statusCode,
        response: result.response,
        error: result.error,
        attemptNumber: result.attemptNumber
      }
    });
  }

  /**
   * Handle webhook failure
   */
  private async handleWebhookFailure(webhookId: string) {
    // Get recent delivery history
    const recentDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhookId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // If high failure rate, disable webhook
    const failureRate = recentDeliveries.filter(d => !d.success).length / recentDeliveries.length;
    if (failureRate > 0.8 && recentDeliveries.length >= 5) {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          active: false,
          deactivatedAt: new Date(),
          deactivationReason: 'High failure rate'
        }
      });
    }
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(secret: string, payload: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify webhook signature
   */
  public verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(secret, payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get webhook delivery history
   */
  public async getWebhookDeliveries(
    webhookId: string,
    options: {
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      success,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = options;

    return prisma.webhookDelivery.findMany({
      where: {
        webhookId,
        ...(typeof success === 'boolean' ? { success } : {}),
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });
  }

  /**
   * Rotate webhook secret
   */
  public async rotateWebhookSecret(webhookId: string): Promise<string> {
    const newSecret = this.generateWebhookSecret();

    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        secret: newSecret,
        secretRotatedAt: new Date()
      }
    });

    return newSecret;
  }

  /**
   * Get webhook stats
   */
  public async getWebhookStats(webhookId: string, period: { startDate: Date; endDate: Date }) {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhookId,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate
        }
      }
    });

    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.success).length;
    const failedDeliveries = totalDeliveries - successfulDeliveries;

    const averageResponseTime = deliveries.reduce((sum, delivery) => {
      return sum + (delivery.responseTime || 0);
    }, 0) / totalDeliveries;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0,
      averageResponseTime,
      deliveriesByDay: this.aggregateDeliveriesByDay(deliveries, period)
    };
  }

  /**
   * Aggregate webhook deliveries by day
   */
  private aggregateDeliveriesByDay(
    deliveries: any[],
    period: { startDate: Date; endDate: Date }
  ) {
    const dailyStats = new Map<string, { total: number; successful: number }>();
    
    let currentDate = new Date(period.startDate);
    while (currentDate <= period.endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyStats.set(dateKey, { total: 0, successful: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (const delivery of deliveries) {
      const dateKey = delivery.createdAt.toISOString().split('T')[0];
      const stats = dailyStats.get(dateKey) || { total: 0, successful: 0 };
      stats.total++;
      if (delivery.success) {
        stats.successful++;
      }
      dailyStats.set(dateKey, stats);
    }

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));
  }
}