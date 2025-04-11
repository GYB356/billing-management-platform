import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface CreateCreditNoteParams {
  invoiceId: string;
  amount: number;
  reason: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export class CreditNoteService {
  async createCreditNote({
    invoiceId,
    amount,
    reason,
    notes,
    metadata = {}
  }: CreateCreditNoteParams) {
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

    // Generate credit note number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const latestCreditNote = await prisma.creditNote.findFirst({
      where: {
        number: {
          startsWith: `CN-${year}${month}`
        }
      },
      orderBy: {
        number: 'desc'
      }
    });

    let sequence = 1;
    if (latestCreditNote) {
      const lastSequence = parseInt(latestCreditNote.number.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const creditNoteNumber = `CN-${year}${month}-${sequence.toString().padStart(4, '0')}`;

    // Create credit note
    const creditNote = await prisma.creditNote.create({
      data: {
        number: creditNoteNumber,
        invoiceId,
        organizationId: invoice.organizationId,
        amount,
        totalAmount: amount,
        currency: invoice.currency,
        notes,
        metadata,
        status: 'ISSUED'
      }
    });

    // Create credit adjustment for the customer
    await prisma.creditAdjustment.create({
      data: {
        customerId: invoice.customerId,
        organizationId: invoice.organizationId,
        amount,
        type: 'CREDIT',
        description: `Credit note ${creditNoteNumber} issued for invoice ${invoice.number}`,
        reason,
        invoiceId,
        adjustedById: metadata.adjustedById || 'SYSTEM',
        metadata
      }
    });

    // Update customer credit balance
    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: {
        creditBalance: {
          increment: amount
        }
      }
    });

    // Create event
    await createEvent({
      eventType: 'CREDIT_NOTE_CREATED',
      resourceType: 'CREDIT_NOTE',
      resourceId: creditNote.id,
      organizationId: invoice.organizationId,
      metadata: {
        creditNoteNumber,
        invoiceNumber: invoice.number,
        amount,
        reason
      }
    });

    // Send notification
    await createNotification({
      organizationId: invoice.organizationId,
      title: 'Credit Note Issued',
      message: `Credit note ${creditNoteNumber} for ${formatCurrency(amount, invoice.currency)} has been issued against invoice ${invoice.number}.`,
      type: 'INFO',
      data: {
        creditNoteId: creditNote.id,
        invoiceId,
        amount
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
    });

    return creditNote;
  }

  async getCreditNote(id: string) {
    return prisma.creditNote.findUnique({
      where: { id },
      include: {
        invoice: true,
        organization: true
      }
    });
  }

  async listCreditNotes(organizationId: string, filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
  } = {}) {
    return prisma.creditNote.findMany({
      where: {
        organizationId,
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
        ...(filters.status && {
          status: filters.status
        })
      },
      include: {
        invoice: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}