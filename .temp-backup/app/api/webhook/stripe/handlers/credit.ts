import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import Stripe from 'stripe';

export async function handleRefundCreated(refund: Stripe.Refund) {
  const payment = await prisma.payment.findFirst({
    where: {
      stripePaymentIntentId: refund.payment_intent as string
    },
    include: {
      invoice: {
        include: {
          organization: true,
          customer: true
        }
      }
    }
  });

  if (!payment || !payment.invoice) {
    console.error(`Payment not found for refund ${refund.id}`);
    return;
  }

  const { invoice, invoice: { organization, customer } } = payment;

  await prisma.$transaction(async (tx) => {
    // Update invoice status
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: refund.amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAmount: {
          increment: refund.amount
        }
      }
    });

    // Create credit adjustment if the refund is set to be credited to customer balance
    if (refund.metadata?.creditToBalance === 'true') {
      // Update customer credit balance
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          creditBalance: {
            increment: refund.amount
          }
        }
      });

      // Create credit adjustment record
      await tx.creditAdjustment.create({
        data: {
          customerId: customer.id,
          organizationId: organization.id,
          amount: refund.amount,
          type: 'CREDIT',
          description: `Refund credited to balance for invoice ${invoice.number}`,
          reason: refund.reason || 'Refund credited to balance',
          invoiceId: invoice.id,
          adjustedById: 'SYSTEM',
          metadata: {
            stripeRefundId: refund.id,
            paymentIntentId: refund.payment_intent
          }
        }
      });
    }

    // Create event
    await createEvent({
      eventType: 'PAYMENT_REFUNDED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      organizationId: organization.id,
      metadata: {
        refundId: refund.id,
        amount: refund.amount,
        reason: refund.reason,
        creditedToBalance: refund.metadata?.creditToBalance === 'true'
      }
    });

    // Send notification
    await createNotification({
      organizationId: organization.id,
      title: 'Payment Refunded',
      message: `A refund of ${formatCurrency(refund.amount, refund.currency)} has been processed for invoice ${invoice.number}.${
        refund.metadata?.creditToBalance === 'true'
          ? ' The amount has been credited to your balance.'
          : ''
      }`,
      type: 'INFO',
      data: {
        invoiceId: invoice.id,
        paymentId: payment.id,
        refundId: refund.id,
        amount: refund.amount
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
    });
  });
}

export async function handleCustomerBalanceTransactionCreated(
  balanceTransaction: Stripe.CustomerBalanceTransaction
) {
  const customer = await prisma.customer.findFirst({
    where: {
      stripeCustomerId: balanceTransaction.customer as string
    },
    include: {
      organization: true
    }
  });

  if (!customer) {
    console.error(`Customer not found for balance transaction ${balanceTransaction.id}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Update customer credit balance
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        creditBalance: {
          increment: balanceTransaction.amount
        }
      }
    });

    // Create credit adjustment record
    const adjustment = await tx.creditAdjustment.create({
      data: {
        customerId: customer.id,
        organizationId: customer.organizationId,
        amount: balanceTransaction.amount,
        type: balanceTransaction.amount > 0 ? 'CREDIT' : 'DEBIT',
        description: balanceTransaction.description || 'Balance adjustment from Stripe',
        reason: 'Stripe balance transaction',
        adjustedById: 'SYSTEM',
        metadata: {
          stripeBalanceTransactionId: balanceTransaction.id
        }
      }
    });

    // Create event
    await createEvent({
      eventType: balanceTransaction.amount > 0 ? 'CREDIT_ADDED' : 'CREDIT_DEDUCTED',
      resourceType: 'CUSTOMER',
      resourceId: customer.id,
      organizationId: customer.organizationId,
      metadata: {
        amount: balanceTransaction.amount,
        transactionId: balanceTransaction.id,
        adjustmentId: adjustment.id
      }
    });

    // Send notification
    await createNotification({
      organizationId: customer.organizationId,
      title: balanceTransaction.amount > 0 ? 'Credit Added' : 'Credit Deducted',
      message: `${Math.abs(balanceTransaction.amount)} ${balanceTransaction.currency.toUpperCase()} has been ${
        balanceTransaction.amount > 0 ? 'added to' : 'deducted from'
      } your balance.`,
      type: 'INFO',
      data: {
        customerId: customer.id,
        amount: balanceTransaction.amount,
        transactionId: balanceTransaction.id,
        adjustmentId: adjustment.id
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
    });
  });
}