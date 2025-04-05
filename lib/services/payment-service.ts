import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { createEvent } from '../events';

export interface PaymentParams {
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface RefundParams {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export class PaymentService {
  /**
   * Process a payment
   */
  public async processPayment(params: PaymentParams) {
    const {
      invoiceId,
      amount,
      currency,
      paymentMethodId,
      customerId,
      description,
      metadata = {}
    } = params;

    try {
      // Get the invoice
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          organization: true
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'PAID') {
        throw new Error('Invoice is already paid');
      }

      const organization = invoice.organization;

      // Create payment intent in Stripe
      let stripePaymentIntentId = null;
      if (organization.stripeCustomerId && paymentMethodId) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          customer: organization.stripeCustomerId,
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

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          invoiceId,
          organizationId: organization.id,
          amount,
          currency,
          status: stripePaymentIntentId ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          stripePaymentIntentId,
          paymentMethodId,
          description: description || `Payment for invoice ${invoice.number}`,
          metadata
        }
      });

      // Update invoice if payment was successful
      if (payment.status === PaymentStatus.COMPLETED) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date()
          }
        });

        // Create payment success event
        await createEvent({
          type: 'PAYMENT_SUCCEEDED',
          resourceType: 'PAYMENT',
          resourceId: payment.id,
          metadata: {
            amount,
            currency,
            invoiceId
          }
        });
      }

      return payment;
    } catch (error) {
      // Log payment failure
      await createEvent({
        type: 'PAYMENT_FAILED',
        resourceType: 'INVOICE',
        resourceId: invoiceId,
        severity: 'ERROR',
        metadata: {
          error: error.message,
          amount,
          currency
        }
      });

      throw error;
    }
  }

  /**
   * Process a refund
   */
  public async processRefund(params: RefundParams) {
    const { paymentId, amount, reason, metadata = {} } = params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Can only refund completed payments');
    }

    // Process refund in Stripe if applicable
    let stripeRefundId = null;
    if (payment.stripePaymentIntentId) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount || undefined,
        reason: reason as Stripe.RefundCreateParams.Reason || undefined,
        metadata: {
          paymentId,
          ...metadata
        }
      });

      stripeRefundId = refund.id;
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        paymentId,
        amount: amount || payment.amount,
        reason,
        status: PaymentStatus.COMPLETED,
        stripeRefundId,
        metadata
      }
    });

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: amount === payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED
      }
    });

    // Create refund event
    await createEvent({
      type: 'PAYMENT_REFUNDED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      metadata: {
        refundId: refund.id,
        amount: refund.amount,
        reason
      }
    });

    return refund;
  }

  /**
   * Retry a failed payment
   */
  public async retryPayment(paymentId: string, newPaymentMethodId?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        organization: true
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new Error('Can only retry failed payments');
    }

    // Update payment method if provided
    if (newPaymentMethodId && payment.organization.stripeCustomerId) {
      await stripe.customers.update(payment.organization.stripeCustomerId, {
        default_payment_method: newPaymentMethodId
      });
    }

    // Create new payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: payment.amount,
      currency: payment.currency,
      customer: payment.organization.stripeCustomerId!,
      payment_method: newPaymentMethodId || undefined,
      off_session: true,
      confirm: true,
      description: payment.description,
      metadata: {
        ...payment.metadata,
        originalPaymentId: payment.id,
        isRetry: true
      }
    });

    // Create new payment record
    const retryPayment = await prisma.payment.create({
      data: {
        invoiceId: payment.invoiceId,
        organizationId: payment.organizationId,
        amount: payment.amount,
        currency: payment.currency,
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: paymentIntent.id,
        paymentMethodId: newPaymentMethodId || payment.paymentMethodId,
        description: `Retry: ${payment.description}`,
        metadata: {
          ...payment.metadata,
          originalPaymentId: payment.id,
          isRetry: true
        }
      }
    });

    // Update invoice if payment was successful
    if (retryPayment.status === PaymentStatus.COMPLETED) {
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      // Create payment success event
      await createEvent({
        type: 'PAYMENT_RETRY_SUCCEEDED',
        resourceType: 'PAYMENT',
        resourceId: retryPayment.id,
        metadata: {
          originalPaymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency
        }
      });
    }

    return retryPayment;
  }

  /**
   * Get payment history for an organization
   */
  public async getPaymentHistory(organizationId: string, options: {
    status?: PaymentStatus[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}) {
    const {
      status,
      startDate,
      endDate,
      limit = 10,
      offset = 0
    } = options;

    return prisma.payment.findMany({
      where: {
        organizationId,
        ...(status ? { status: { in: status } } : {}),
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        } : {})
      },
      include: {
        invoice: true,
        refunds: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });
  }

  /**
   * Get detailed payment stats for an organization
   */
  public async getPaymentStats(organizationId: string, startDate: Date, endDate: Date) {
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        refunds: true
      }
    });

    const stats = {
      totalPayments: payments.length,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      refundedAmount: 0,
      netAmount: 0,
      byCurrency: {} as Record<string, {
        totalAmount: number;
        refundedAmount: number;
        netAmount: number;
      }>
    };

    for (const payment of payments) {
      if (!stats.byCurrency[payment.currency]) {
        stats.byCurrency[payment.currency] = {
          totalAmount: 0,
          refundedAmount: 0,
          netAmount: 0
        };
      }

      if (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.PARTIALLY_REFUNDED) {
        stats.successfulPayments++;
        stats.totalAmount += payment.amount;
        stats.byCurrency[payment.currency].totalAmount += payment.amount;
      } else if (payment.status === PaymentStatus.FAILED) {
        stats.failedPayments++;
      }

      const refundedAmount = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      stats.refundedAmount += refundedAmount;
      stats.byCurrency[payment.currency].refundedAmount += refundedAmount;
    }

    stats.netAmount = stats.totalAmount - stats.refundedAmount;
    for (const currency in stats.byCurrency) {
      stats.byCurrency[currency].netAmount = 
        stats.byCurrency[currency].totalAmount - 
        stats.byCurrency[currency].refundedAmount;
    }

    return stats;
  }
}