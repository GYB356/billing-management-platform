import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { createEvent } from '../events';

export interface PaymentParams {
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export async function processPayment(params: PaymentParams) {
  const {
    invoiceId,
    amount,
    currency,
    paymentMethodId,
    customerId,
    description,
    metadata
  } = params;

  try {
    // Get the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        organization: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new Error('Invoice is already paid');
    }

    // Get customer and organization
    const customer = invoice.customer;
    const organization = invoice.organization;

    if (!customer) {
      throw new Error('Customer not found');
    }

    let stripePaymentIntentId = null;

    // Create a payment intent if Stripe is enabled
    if (paymentMethodId && customer.stripeCustomerId) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customer.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: description || `Payment for invoice ${invoice.number}`,
        metadata: {
          invoiceId,
          organizationId: organization.id,
          ...metadata
        }
      });

      stripePaymentIntentId = paymentIntent.id;
    }

    // Create payment record in database
    const payment = await prisma.oneTimePayment.create({
      data: {
        amount,
        currency,
        status: stripePaymentIntentId ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        invoiceId,
        customerId,
        organizationId: organization.id,
        stripePaymentIntentId,
        description: description || `Payment for invoice ${invoice.number}`,
        metadata
      }
    });

    // Update invoice status if payment was successful
    if (payment.status === PaymentStatus.COMPLETED) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      // Create event for invoice paid
      await createEvent({
        eventType: 'INVOICE_PAID',
        resourceType: 'INVOICE',
        resourceId: invoiceId,
        severity: 'INFO',
        metadata: {
          invoiceId,
          paymentId: payment.id,
          amount,
          currency
        }
      });
    }

    return payment;
  } catch (error: any) {
    // Create event for payment failure
    await createEvent({
      eventType: 'PAYMENT_FAILED',
      resourceType: 'INVOICE',
      resourceId: invoiceId,
      severity: 'WARNING',
      metadata: {
        invoiceId,
        error: error.message,
        amount,
        currency
      }
    });

    throw error;
  }
}

export async function refundPayment(
  paymentId: string,
  amount?: number,
  reason?: string
) {
  try {
    const payment = await prisma.oneTimePayment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Payment cannot be refunded because it is not completed');
    }

    if (payment.refunded) {
      throw new Error('Payment has already been refunded');
    }

    let stripeRefundId = null;

    // Process refund in Stripe if payment has Stripe ID
    if (payment.stripePaymentIntentId) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount || undefined,
        reason: (reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined) || undefined
      });

      stripeRefundId = refund.id;
    }

    // Update payment in database
    const updatedPayment = await prisma.oneTimePayment.update({
      where: { id: paymentId },
      data: {
        refunded: true,
        refundedAmount: amount || payment.amount,
        refundedAt: new Date(),
        refundReason: reason,
        stripeRefundId
      }
    });

    // Update invoice status if full refund
    if (!amount || amount === payment.amount) {
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: 'REFUNDED'
        }
      });
    }

    // Create event for refund
    await createEvent({
      eventType: 'PAYMENT_REFUNDED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      severity: 'INFO',
      metadata: {
        paymentId,
        invoiceId: payment.invoiceId,
        amount: amount || payment.amount,
        reason
      }
    });

    return updatedPayment;
  } catch (error: any) {
    // Create event for refund failure
    await createEvent({
      eventType: 'REFUND_FAILED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      severity: 'WARNING',
      metadata: {
        paymentId,
        error: error.message,
        amount
      }
    });

    throw error;
  }
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return prisma.oneTimePayment.findMany({
    where: { invoiceId }
  });
}

export async function getPaymentsByCustomer(customerId: string, options?: {
  limit?: number;
  offset?: number;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
}) {
  const { limit = 10, offset = 0, status, startDate, endDate } = options || {};

  const where: any = { customerId };

  if (status) {
    where.status = status;
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

  const [payments, total] = await Promise.all([
    prisma.oneTimePayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            status: true
          }
        }
      }
    }),
    prisma.oneTimePayment.count({ where })
  ]);

  return {
    data: payments,
    meta: {
      total,
      limit,
      offset
    }
  };
} 