import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { PaymentService } from './payment-service';

interface RetryStrategy {
  maxAttempts: number;
  intervals: number[]; // Hours between retry attempts
  requireNewPaymentMethod: boolean;
}

const RETRY_STRATEGIES: Record<string, RetryStrategy> = {
  DEFAULT: {
    maxAttempts: 4,
    intervals: [24, 72, 168], // 1 day, 3 days, 7 days
    requireNewPaymentMethod: false
  },
  AGGRESSIVE: {
    maxAttempts: 6,
    intervals: [3, 24, 72, 168, 336], // 3h, 1d, 3d, 7d, 14d
    requireNewPaymentMethod: true
  },
  CONSERVATIVE: {
    maxAttempts: 3,
    intervals: [72, 168], // 3 days, 7 days
    requireNewPaymentMethod: true
  }
};

export class PaymentRetryService {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Analyze failure and determine best retry strategy
   */
  private async determineRetryStrategy(
    failureCode: string,
    customerRiskScore: number,
    previousAttempts: number
  ): Promise<RetryStrategy> {
    // High-risk scenarios - use conservative approach
    if (
      failureCode.includes('fraudulent') ||
      failureCode.includes('stolen_card') ||
      customerRiskScore > 80
    ) {
      return RETRY_STRATEGIES.CONSERVATIVE;
    }

    // Temporary failures - use aggressive approach
    if (
      failureCode.includes('insufficient_funds') ||
      failureCode.includes('processing_error') ||
      failureCode.includes('expired_card')
    ) {
      return RETRY_STRATEGIES.AGGRESSIVE;
    }

    // Default strategy for all other cases
    return RETRY_STRATEGIES.DEFAULT;
  }

  /**
   * Calculate next retry date based on strategy and attempt number
   */
  private calculateNextRetryDate(
    strategy: RetryStrategy,
    attemptNumber: number
  ): Date {
    const hoursDelay = strategy.intervals[attemptNumber - 1] || 
                      strategy.intervals[strategy.intervals.length - 1];
    
    return new Date(Date.now() + hoursDelay * 60 * 60 * 1000);
  }

  /**
   * Schedule a payment retry
   */
  public async scheduleRetry({
    subscriptionId,
    invoiceId,
    amount,
    failureCode,
    paymentMethodId
  }: {
    subscriptionId: string;
    invoiceId: string;
    amount: number;
    failureCode: string;
    paymentMethodId?: string;
  }) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const previousAttempts = subscription.paymentAttempts.length;
    const customerRiskScore = await this.calculateCustomerRiskScore(subscription.organization.id);
    const strategy = await this.determineRetryStrategy(
      failureCode,
      customerRiskScore,
      previousAttempts
    );

    // Check if we've exceeded max attempts
    if (previousAttempts >= strategy.maxAttempts) {
      await this.handleMaxAttemptsExceeded(subscription, invoiceId);
      return;
    }

    // Calculate next retry date
    const nextRetryDate = this.calculateNextRetryDate(strategy, previousAttempts + 1);

    // Create payment attempt record
    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        subscriptionId,
        invoiceId,
        amount,
        currency: subscription.organization.currency || 'USD',
        status: 'SCHEDULED',
        paymentMethodId,
        scheduledFor: nextRetryDate,
        metadata: {
          attemptNumber: previousAttempts + 1,
          failureCode,
          requireNewPaymentMethod: strategy.requireNewPaymentMethod
        }
      }
    });

    // Create event
    await createEvent({
      organizationId: subscription.organization.id,
      eventType: 'PAYMENT_RETRY_SCHEDULED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscriptionId,
      metadata: {
        paymentAttemptId: paymentAttempt.id,
        nextRetryDate,
        attemptNumber: previousAttempts + 1
      }
    });

    // Send notification if new payment method is required
    if (strategy.requireNewPaymentMethod) {
      await createNotification({
        organizationId: subscription.organization.id,
        title: 'Update Payment Method Required',
        message: `Your last payment failed. Please update your payment method before the next retry on ${nextRetryDate.toLocaleDateString()}.`,
        type: 'WARNING',
        data: {
          subscriptionId,
          invoiceId,
          nextRetryDate,
          amount
        },
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
      });
    }

    return paymentAttempt;
  }

  /**
   * Process scheduled retry attempts
   */
  public async processScheduledRetries() {
    const dueAttempts = await prisma.paymentAttempt.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: new Date()
        }
      },
      include: {
        subscription: {
          include: {
            organization: true
          }
        }
      }
    });

    for (const attempt of dueAttempts) {
      try {
        // Skip if new payment method is required but not provided
        if (
          attempt.metadata?.requireNewPaymentMethod &&
          !attempt.metadata?.newPaymentMethodId
        ) {
          continue;
        }

        // Process the retry
        const result = await this.paymentService.retryPayment(
          attempt.invoiceId,
          attempt.metadata?.newPaymentMethodId
        );

        // Update attempt status
        await prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: result.status,
            failureCode: result.failureCode,
            failureMessage: result.failureMessage,
            processedAt: new Date()
          }
        });

        // Schedule next retry if failed
        if (result.status === 'FAILED') {
          await this.scheduleRetry({
            subscriptionId: attempt.subscriptionId,
            invoiceId: attempt.invoiceId,
            amount: attempt.amount,
            failureCode: result.failureCode || 'unknown_error',
            paymentMethodId: attempt.paymentMethodId
          });
        }
      } catch (error) {
        console.error(`Error processing retry attempt ${attempt.id}:`, error);
      }
    }
  }

  /**
   * Calculate customer risk score (0-100)
   */
  private async calculateCustomerRiskScore(organizationId: string): Promise<number> {
    const history = await prisma.paymentAttempt.findMany({
      where: {
        subscription: {
          organizationId
        },
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      }
    });

    if (history.length === 0) return 0;

    const failureRate = history.filter(h => h.status === 'FAILED').length / history.length;
    const fraudulentAttempts = history.filter(h => 
      h.failureCode?.includes('fraudulent') ||
      h.failureCode?.includes('stolen_card')
    ).length;

    // Calculate risk score (0-100)
    return Math.min(
      100,
      (failureRate * 50) + // Up to 50 points for failure rate
      (fraudulentAttempts * 25) + // 25 points per fraudulent attempt
      (history.length > 10 ? 0 : 20) // 20 points for new customers
    );
  }

  /**
   * Handle when maximum retry attempts are exceeded
   */
  private async handleMaxAttemptsExceeded(subscription: any, invoiceId: string) {
    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE'
      }
    });

    // Create event
    await createEvent({
      organizationId: subscription.organization.id,
      eventType: 'PAYMENT_RETRY_MAX_ATTEMPTS',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      metadata: {
        invoiceId,
        totalAttempts: subscription.paymentAttempts.length
      }
    });

    // Send notification
    await createNotification({
      organizationId: subscription.organization.id,
      title: 'Payment Recovery Failed',
      message: 'We were unable to process your payment after multiple attempts. Please update your payment method to avoid service interruption.',
      type: 'ERROR',
      data: {
        subscriptionId: subscription.id,
        invoiceId,
        totalAttempts: subscription.paymentAttempts.length
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
    });
  }
}