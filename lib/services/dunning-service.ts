import { prisma } from '@/lib/prisma';
import { PaymentStatus, DunningStep, DunningAction } from '@prisma/client';
import { PaymentService } from './payment-service';
import { createEvent } from '../events';
import { sendEmail } from '../email';

interface DunningConfig {
  steps: Array<{
    daysPastDue: number;
    actions: DunningAction[];
    retryPayment: boolean;
    sendEmail: boolean;
    emailTemplate: string;
    suspendService: boolean;
  }>;
  maxRetries: number;
  gracePeriodDays: number;
}

export class DunningService {
  private readonly paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Process dunning for all past due subscriptions
   */
  public async processDunning() {
    const pastDueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        invoices: {
          some: {
            status: 'PAST_DUE'
          }
        }
      },
      include: {
        organization: true,
        invoices: {
          where: {
            status: 'PAST_DUE'
          }
        },
        dunningHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    for (const subscription of pastDueSubscriptions) {
      await this.processDunningForSubscription(subscription);
    }
  }

  /**
   * Process dunning for a specific subscription
   */
  private async processDunningForSubscription(subscription: any) {
    const config = await this.getDunningConfig(subscription.organizationId);
    const pastDueInvoice = subscription.invoices[0];
    const daysPastDue = this.getDaysPastDue(pastDueInvoice.dueDate);

    // Find the appropriate dunning step based on days past due
    const step = config.steps.find(s => 
      daysPastDue >= s.daysPastDue && 
      (!s.nextStep || daysPastDue < s.nextStep.daysPastDue)
    );

    if (!step) {
      return;
    }

    // Check if this step has already been executed
    const stepExecuted = subscription.dunningHistory.some(history =>
      history.daysPastDue === step.daysPastDue &&
      new Date(history.createdAt).toDateString() === new Date().toDateString()
    );

    if (stepExecuted) {
      return;
    }

    // Execute dunning actions
    await this.executeDunningStep(subscription, pastDueInvoice, step, config);
  }

  /**
   * Execute dunning step actions
   */
  private async executeDunningStep(
    subscription: any,
    invoice: any,
    step: any,
    config: DunningConfig
  ) {
    const actions: string[] = [];

    // Retry payment if configured
    if (step.retryPayment) {
      const retryCount = subscription.dunningHistory.filter(h => h.action === 'PAYMENT_RETRY').length;

      if (retryCount < config.maxRetries) {
        try {
          await this.paymentService.retryPayment(invoice.paymentId);
          actions.push('PAYMENT_RETRY');
        } catch (error) {
          console.error('Payment retry failed:', error);
        }
      }
    }

    // Send email notification
    if (step.sendEmail && subscription.organization.email) {
      try {
        await sendEmail(
          subscription.organization.email,
          step.emailTemplate,
          {
            organizationName: subscription.organization.name,
            invoiceNumber: invoice.number,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            daysPastDue: this.getDaysPastDue(invoice.dueDate)
          }
        );
        actions.push('EMAIL_SENT');
      } catch (error) {
        console.error('Email sending failed:', error);
      }
    }

    // Suspend service if configured
    if (step.suspendService && !subscription.isSuspended) {
      await this.suspendService(subscription.id);
      actions.push('SERVICE_SUSPENDED');
    }

    // Record dunning history
    await prisma.dunningHistory.create({
      data: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        daysPastDue: this.getDaysPastDue(invoice.dueDate),
        actions,
        metadata: {
          step: step.daysPastDue,
          retryCount: subscription.dunningHistory.filter(h => h.action === 'PAYMENT_RETRY').length + 1
        }
      }
    });

    // Create event
    await createEvent({
      type: 'DUNNING_STEP_EXECUTED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      metadata: {
        invoiceId: invoice.id,
        daysPastDue: this.getDaysPastDue(invoice.dueDate),
        actions,
        step: step.daysPastDue
      }
    });
  }

  /**
   * Suspend service for a subscription
   */
  private async suspendService(subscriptionId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isSuspended: true,
        suspendedAt: new Date()
      }
    });

    // Create event
    await createEvent({
      type: 'SERVICE_SUSPENDED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscriptionId,
      severity: 'HIGH'
    });
  }

  /**
   * Resume service for a subscription
   */
  public async resumeService(subscriptionId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isSuspended: false,
        suspendedAt: null
      }
    });

    // Create event
    await createEvent({
      type: 'SERVICE_RESUMED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscriptionId
    });
  }

  /**
   * Get dunning configuration for an organization
   */
  private async getDunningConfig(organizationId: string): Promise<DunningConfig> {
    const orgConfig = await prisma.organizationConfig.findUnique({
      where: { organizationId },
      select: { dunningConfig: true }
    });

    // Return organization-specific config if it exists, otherwise return default config
    return orgConfig?.dunningConfig || this.getDefaultDunningConfig();
  }

  /**
   * Get default dunning configuration
   */
  private getDefaultDunningConfig(): DunningConfig {
    return {
      steps: [
        {
          daysPastDue: 1,
          actions: ['EMAIL'],
          retryPayment: true,
          sendEmail: true,
          emailTemplate: 'payment-failed-first-attempt',
          suspendService: false
        },
        {
          daysPastDue: 3,
          actions: ['EMAIL', 'PAYMENT_RETRY'],
          retryPayment: true,
          sendEmail: true,
          emailTemplate: 'payment-failed-second-attempt',
          suspendService: false
        },
        {
          daysPastDue: 7,
          actions: ['EMAIL', 'PAYMENT_RETRY'],
          retryPayment: true,
          sendEmail: true,
          emailTemplate: 'payment-failed-final-warning',
          suspendService: false
        },
        {
          daysPastDue: 14,
          actions: ['EMAIL', 'SUSPEND'],
          retryPayment: false,
          sendEmail: true,
          emailTemplate: 'service-suspended',
          suspendService: true
        }
      ],
      maxRetries: 3,
      gracePeriodDays: 14
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
   * Get dunning status for a subscription
   */
  public async getDunningStatus(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        invoices: {
          where: {
            status: 'PAST_DUE'
          }
        },
        dunningHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const pastDueInvoice = subscription.invoices[0];
    if (!pastDueInvoice) {
      return {
        status: 'CURRENT',
        daysPastDue: 0,
        lastAction: null,
        actionHistory: []
      };
    }

    return {
      status: subscription.isSuspended ? 'SUSPENDED' : 'PAST_DUE',
      daysPastDue: this.getDaysPastDue(pastDueInvoice.dueDate),
      lastAction: subscription.dunningHistory[0] || null,
      actionHistory: subscription.dunningHistory
    };
  }
}