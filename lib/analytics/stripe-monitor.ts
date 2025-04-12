import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import Analytics from './posthog';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      STRIPE_SECRET_KEY: string;
    }
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export interface StripeEventMetrics {
  successfulPayments: number;
  failedPayments: number;
  totalRevenue: number;
  averageTransactionValue: number;
  disputeRate: number;
}

export const processStripeEvent = async (event: Stripe.Event) => {
  try {
    // Store the event in the database for analysis
    await prisma.stripeEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        data: event.data.object as any,
        created: new Date(event.created * 1000),
      },
    });

    // Process specific event types
    switch (event.type) {
      case 'charge.succeeded':
        const charge = event.data.object as Stripe.Charge;
        await handleSuccessfulCharge(charge);
        break;

      case 'customer.subscription.created':
        const subscription = event.data.object as Stripe.Subscription;
        await handleNewSubscription(subscription);
        break;

      case 'customer.subscription.deleted':
        await handleCancelledSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handleFailedPayment(event.data.object as Stripe.Invoice);
        break;
    }

    // Track event in PostHog
    if (event.data.object && 'customer' in event.data.object) {
      const customerId = (event.data.object as any).customer;
      await Analytics.track.stripeEvent(customerId, event.type);
    }

  } catch (error) {
    logger.error('Error processing Stripe event', error as Error, { eventId: event.id });
    throw error;
  }
};

export const getStripeMetrics = async (days: number = 30): Promise<StripeEventMetrics> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get successful payments
    const successfulPayments = await prisma.stripeEvent.count({
      where: {
        type: 'charge.succeeded',
        created: {
          gte: startDate,
        },
      },
    });

    // Get failed payments
    const failedPayments = await prisma.stripeEvent.count({
      where: {
        type: 'charge.failed',
        created: {
          gte: startDate,
        },
      },
    });

    // Calculate total revenue
    const revenue = await prisma.stripeEvent.findMany({
      where: {
        type: 'charge.succeeded',
        created: {
          gte: startDate,
        },
      },
      select: {
        data: true,
      },
    });

    const totalRevenue = revenue.reduce((sum, event) => {
      const amount = (event.data as any).amount || 0;
      return sum + amount / 100; // Convert from cents to dollars
    }, 0);

    // Calculate average transaction value
    const averageTransactionValue = successfulPayments > 0 
      ? totalRevenue / successfulPayments 
      : 0;

    // Calculate dispute rate
    const disputes = await prisma.stripeEvent.count({
      where: {
        type: 'charge.dispute.created',
        created: {
          gte: startDate,
        },
      },
    });

    const disputeRate = successfulPayments > 0 
      ? (disputes / successfulPayments) * 100 
      : 0;

    return {
      successfulPayments,
      failedPayments,
      totalRevenue,
      averageTransactionValue,
      disputeRate,
    };
  } catch (error) {
    logger.error('Error getting Stripe metrics', error as Error);
    throw error;
  }
};

async function handleSuccessfulCharge(charge: Stripe.Charge) {
  // Update revenue metrics
  await prisma.payment.create({
    data: {
      amount: charge.amount / 100,
      currency: charge.currency,
      status: 'SUCCEEDED',
      stripeChargeId: charge.id,
      customerId: charge.customer as string,
    },
  });
}

async function handleNewSubscription(subscription: Stripe.Subscription) {
  await prisma.subscription.create({
    data: {
      stripeSubscriptionId: subscription.id,
      customerId: subscription.customer as string,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      planId: subscription.items.data[0].price.id,
    },
  });
}

async function handleCancelledSubscription(subscription: Stripe.Subscription) {
  await prisma.subscription.update({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    data: {
      status: 'CANCELED',
      cancelledAt: new Date(),
    },
  });
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  await prisma.payment.create({
    data: {
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'FAILED',
      stripeInvoiceId: invoice.id,
      customerId: invoice.customer as string,
    },
  });
} 