import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { PaymentRetryService } from '@/lib/services/payment-retry-service';
import Stripe from 'stripe';

export async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Get associated invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id
    },
    include: {
      subscription: {
        include: {
          organization: true,
          plan: true
        }
      }
    }
  });

  if (!invoice || !invoice.subscription) {
    console.error('Invoice or subscription not found for payment intent:', paymentIntent.id);
    return;
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'PAST_DUE',
      lastPaymentError: paymentIntent.last_payment_error?.message || 'Payment failed'
    }
  });

  // Initialize retry service
  const retryService = new PaymentRetryService();

  // Schedule payment retry
  await retryService.scheduleRetry({
    subscriptionId: invoice.subscriptionId,
    invoiceId: invoice.id,
    amount: invoice.amount,
    failureCode: paymentIntent.last_payment_error?.code || 'unknown',
    paymentMethodId: invoice.defaultPaymentMethodId
  });

  // Create event
  await createEvent({
    organizationId: invoice.subscription.organizationId,
    eventType: 'PAYMENT_FAILED',
    resourceType: 'INVOICE',
    resourceId: invoice.id,
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: invoice.amount,
      failureReason: paymentIntent.last_payment_error?.message,
      failureCode: paymentIntent.last_payment_error?.code
    }
  });

  // Send notification
  await createNotification({
    organizationId: invoice.subscription.organizationId,
    title: 'Payment Failed',
    message: `Your payment of ${formatCurrency(invoice.amount, invoice.currency)} for ${invoice.subscription.plan.name} failed. We will automatically retry this payment. Please ensure your payment method is up to date.`,
    type: 'WARNING',
    data: {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      amount: invoice.amount,
      failureReason: paymentIntent.last_payment_error?.message
    },
    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
  });
}

export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Get associated invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id
    },
    include: {
      subscription: {
        include: {
          organization: true,
          plan: true
        }
      }
    }
  });

  if (!invoice) {
    console.error('Invoice not found for payment intent:', paymentIntent.id);
    return;
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      lastPaymentError: null
    }
  });

  // Clear any scheduled retry attempts
  await prisma.paymentAttempt.updateMany({
    where: {
      invoiceId: invoice.id,
      status: 'SCHEDULED'
    },
    data: {
      status: 'CANCELLED',
      metadata: {
        cancelReason: 'Payment succeeded'
      }
    }
  });

  // Create event
  await createEvent({
    organizationId: invoice.subscription.organizationId,
    eventType: 'PAYMENT_SUCCEEDED',
    resourceType: 'INVOICE',
    resourceId: invoice.id,
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: invoice.amount
    }
  });

  // Send notification
  await createNotification({
    organizationId: invoice.subscription.organizationId,
    title: 'Payment Successful',
    message: `Your payment of ${formatCurrency(invoice.amount, invoice.currency)} for ${invoice.subscription.plan.name} was successful.`,
    type: 'SUCCESS',
    data: {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      amount: invoice.amount
    },
    channels: [NotificationChannel.IN_APP] // Don't send email for successful payments
  });
}