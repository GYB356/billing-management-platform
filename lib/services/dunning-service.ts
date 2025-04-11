import { prisma } from '@/lib/prisma';
import { PaymentRetryService } from './payment-retry-service';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface DunningConfig {
  steps: Array<{
    daysPastDue: number;
    actions: string[];
    message?: string;
    suspendOnFailure?: boolean;
  }>;
  maxPaymentAttempts: number;
  notificationChannels: NotificationChannel[];
}

export class DunningService {
  private retryService: PaymentRetryService;

  constructor() {
    this.retryService = new PaymentRetryService();
  }

  /**
   * Process dunning for all past due invoices
   */
  public async processDunning() {
    const pastDueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PAST_DUE',
        subscription: {
          status: {
            not: 'CANCELLED'
          }
        }
      },
      include: {
        subscription: {
          include: {
            organization: true,
            plan: true
          }
        },
        paymentAttempts: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    for (const invoice of pastDueInvoices) {
      await this.processDunningForInvoice(invoice);
    }
  }

  /**
   * Process dunning for a specific invoice
   */
  private async processDunningForInvoice(invoice: any) {
    const config = await this.getDunningConfig(invoice.subscription.organizationId);
    const daysPastDue = this.getDaysPastDue(invoice.dueDate);
    
    // Find the appropriate dunning step
    const step = config.steps.find(s => s.daysPastDue <= daysPastDue);
    if (!step) return;

    // Check if we've already processed this step today
    const lastDunningLog = await prisma.dunningLog.findFirst({
      where: {
        invoiceId: invoice.id,
        daysPastDue: step.daysPastDue,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    if (lastDunningLog) return;

    // Execute dunning actions
    await this.executeDunningStep(invoice, step, config);
  }

  /**
   * Execute dunning step actions
   */
  private async executeDunningStep(
    invoice: any,
    step: any,
    config: DunningConfig
  ) {
    const actions: string[] = [];

    // Schedule payment retry if configured
    if (step.actions.includes('RETRY_PAYMENT')) {
      try {
        await this.retryService.scheduleRetry({
          subscriptionId: invoice.subscription.id,
          invoiceId: invoice.id,
          amount: invoice.amount,
          failureCode: invoice.lastPaymentError || 'unknown',
          paymentMethodId: invoice.defaultPaymentMethodId
        });
        actions.push('PAYMENT_RETRY_SCHEDULED');
      } catch (error) {
        console.error('Error scheduling payment retry:', error);
      }
    }

    // Send notifications
    if (step.actions.includes('SEND_NOTIFICATION')) {
      await createNotification({
        organizationId: invoice.subscription.organizationId,
        title: 'Payment Past Due',
        message: step.message || this.getDefaultDunningMessage(invoice, daysPastDue),
        type: 'WARNING',
        data: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription.id,
          amount: invoice.amount,
          daysPastDue: this.getDaysPastDue(invoice.dueDate)
        },
        channels: config.notificationChannels
      });
      actions.push('NOTIFICATION_SENT');
    }

    // Suspend subscription if configured
    if (step.suspendOnFailure && !invoice.subscription.isSuspended) {
      await this.suspendSubscription(invoice.subscription.id);
      actions.push('SUBSCRIPTION_SUSPENDED');
    }

    // Create dunning log
    await prisma.dunningLog.create({
      data: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription.id,
        customerId: invoice.subscription.organization.id,
        daysPastDue: this.getDaysPastDue(invoice.dueDate),
        actions,
        status: 'COMPLETED',
        metadata: {
          step: step.daysPastDue,
          amount: invoice.amount,
          currency: invoice.currency
        }
      }
    });

    // Create event
    await createEvent({
      organizationId: invoice.subscription.organizationId,
      eventType: 'DUNNING_STEP_EXECUTED',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        daysPastDue: this.getDaysPastDue(invoice.dueDate),
        actions,
        step: step.daysPastDue
      }
    });
  }

  /**
   * Get dunning configuration for an organization
   */
  private async getDunningConfig(organizationId: string): Promise<DunningConfig> {
    const config = await prisma.dunningConfig.findFirst({
      where: {
        organizationId,
        isActive: true
      }
    });

    return config || this.getDefaultDunningConfig();
  }

  /**
   * Get default dunning configuration
   */
  private getDefaultDunningConfig(): DunningConfig {
    return {
      steps: [
        {
          daysPastDue: 1,
          actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
          message: 'Your payment is past due. We will automatically retry the payment.'
        },
        {
          daysPastDue: 3,
          actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
          message: 'Your payment is 3 days past due. Please update your payment method.'
        },
        {
          daysPastDue: 7,
          actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
          message: 'Final notice: Your payment is 7 days past due. Service may be suspended.'
        },
        {
          daysPastDue: 14,
          actions: ['SEND_NOTIFICATION'],
          message: 'Your service has been suspended due to non-payment.',
          suspendOnFailure: true
        }
      ],
      maxPaymentAttempts: 4,
      notificationChannels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
    };
  }

  /**
   * Calculate days past due
   */
  private getDaysPastDue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = Math.abs(now.getTime() - due.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get default dunning message
   */
  private getDefaultDunningMessage(invoice: any, daysPastDue: number): string {
    return `Your payment of ${formatCurrency(invoice.amount, invoice.currency)} for ${invoice.subscription.plan.name} is ${daysPastDue} days past due. Please update your payment method to avoid service interruption.`;
  }

  /**
   * Suspend subscription
   */
  private async suspendSubscription(subscriptionId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isSuspended: true,
        suspendedAt: new Date()
      }
    });
  }

  /**
   * Resume subscription
   */
  public async resumeSubscription(subscriptionId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isSuspended: false,
        suspendedAt: null
      }
    });
  }
}