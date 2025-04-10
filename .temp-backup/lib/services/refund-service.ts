import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { CreditNoteService } from './credit-note-service';

interface ProcessRefundParams {
  invoiceId: string;
  amount: number;
  reason: string;
  issueCredit?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export class RefundService {
  private creditNoteService: CreditNoteService;

  constructor() {
    this.creditNoteService = new CreditNoteService();
  }

  async processRefund({
    invoiceId,
    amount,
    reason,
    issueCredit = true,
    notes,
    metadata = {}
  }: ProcessRefundParams) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        customer: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (amount > invoice.total) {
      throw new Error('Refund amount cannot exceed invoice total');
    }

    // Start a transaction for the refund process
    return await prisma.$transaction(async (tx) => {
      // Process refund in Stripe if applicable
      if (invoice.stripePaymentIntentId) {
        await stripe.refunds.create({
          payment_intent: invoice.stripePaymentIntentId,
          amount: amount,
          reason: reason as Stripe.RefundCreateParams.Reason
        });
      }

      // Create credit note if requested
      let creditNote;
      if (issueCredit) {
        creditNote = await this.creditNoteService.createCreditNote({
          invoiceId,
          amount,
          reason,
          notes,
          metadata: {
            ...metadata,
            refundId: metadata.refundId
          }
        });
      }

      // Create credit adjustment for refund
      await tx.creditAdjustment.create({
        data: {
          customerId: invoice.customerId,
          organizationId: invoice.organizationId,
          amount: -amount, // Negative amount for refund
          type: 'REFUND',
          description: `Refund for invoice ${invoice.number}`,
          reason,
          invoiceId,
          adjustedById: metadata.adjustedById || 'SYSTEM',
          metadata: {
            ...metadata,
            creditNoteId: creditNote?.id
          }
        }
      });

      // Update invoice status
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: amount === invoice.total ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundedAmount: {
            increment: amount
          }
        }
      });

      // Create event
      await createEvent({
        eventType: 'INVOICE_REFUNDED',
        resourceType: 'INVOICE',
        resourceId: invoiceId,
        organizationId: invoice.organizationId,
        metadata: {
          amount,
          reason,
          creditNoteId: creditNote?.id,
          isFullRefund: amount === invoice.total
        }
      });

      // Send notification
      await createNotification({
        organizationId: invoice.organizationId,
        title: 'Refund Processed',
        message: `A refund of ${formatCurrency(amount, invoice.currency)} has been processed for invoice ${invoice.number}.`,
        type: 'INFO',
        data: {
          invoiceId,
          amount,
          reason,
          creditNoteId: creditNote?.id
        },
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
      });

      return {
        success: true,
        invoiceId,
        refundedAmount: amount,
        creditNoteId: creditNote?.id
      };
    });
  }

  async getRefundHistory(organizationId: string, filters: {
    startDate?: Date;
    endDate?: Date;
    customerId?: string;
  } = {}) {
    return prisma.creditAdjustment.findMany({
      where: {
        organizationId,
        type: 'REFUND',
        ...(filters.startDate && {
          createdAt: {
            gte: filters.startDate
          }
        }),
        ...(filters.endDate && {
          createdAt: {
            lte: filters.endDate
          }
        }),
        ...(filters.customerId && {
          customerId: filters.customerId
        })
      },
      include: {
        invoice: true,
        customer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}