/**
 * Enhanced invoice service with multi-currency support and customizable templates
 */

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createEvent } from '@/lib/events';
import { generatePDF } from '@/lib/pdf-generator';
import { TaxService } from './tax-service';
import { CurrencyService } from './currency-service';
import { NotificationService } from './notification-service';

interface CreateInvoiceParams {
  subscriptionId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, any>;
  }>;
  dueDate?: Date;
  notes?: string;
  metadata?: Record<string, any>;
}

interface CreateCreditNoteParams {
  invoiceId: string;
  items: Array<{
    invoiceItemId: string;
    quantity: number;
    reason: string;
  }>;
  notes?: string;
  metadata?: Record<string, any>;
}

export class InvoiceService {
  private readonly taxService: TaxService;
  private readonly currencyService: CurrencyService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.taxService = new TaxService();
    this.currencyService = new CurrencyService();
    this.notificationService = new NotificationService();
  }

  /**
   * Create a new invoice
   */
  public async createInvoice({
    subscriptionId,
    items,
    dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    notes,
    metadata = {}
  }: CreateInvoiceParams) {
    // Get subscription and organization details
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate totals and tax
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const tax = await this.taxService.calculateTax({
      amount: subtotal,
      countryCode: subscription.organization.country,
      stateCode: subscription.organization.state,
      customerType: subscription.organization.type,
      vatNumber: subscription.organization.vatNumber
    });

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice in database
    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        organizationId: subscription.organization.id,
        subscriptionId,
        currency: subscription.plan.currency,
        status: 'PENDING',
        dueDate,
        subtotal,
        taxAmount: tax.taxAmount,
        taxRate: tax.taxRate,
        totalAmount: subtotal + tax.taxAmount,
        notes,
        metadata,
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            metadata: item.metadata
          }))
        }
      },
      include: {
        items: true
      }
    });

    // Create Stripe invoice if subscription has Stripe ID
    if (subscription.stripeSubscriptionId) {
      try {
        const stripeInvoice = await stripe.invoices.create({
          customer: subscription.organization.stripeCustomerId!,
          subscription: subscription.stripeSubscriptionId,
          metadata: {
            invoiceId: invoice.id,
            organizationId: subscription.organization.id
          }
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { stripeInvoiceId: stripeInvoice.id }
        });
      } catch (error) {
        console.error('Error creating Stripe invoice:', error);
        // Don't throw - we still want to keep our invoice record
      }
    }

    // Generate PDF
    const pdf = await this.generateInvoicePDF(invoice);
    await this.storePDF(invoice.id, pdf);

    // Send notifications
    await this.notificationService.sendNotification({
      userId: subscription.organization.userId,
      title: 'New Invoice Generated',
      message: `Invoice #${invoice.number} for ${this.currencyService.format(invoice.totalAmount, invoice.currency)} has been generated.`,
      type: 'INFO',
      channels: ['EMAIL', 'IN_APP']
    });

    // Create event
    await createEvent({
      type: 'INVOICE_CREATED',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        amount: invoice.totalAmount,
        currency: invoice.currency
      }
    });

    return invoice;
  }

  /**
   * Create a credit note for an invoice
   */
  public async createCreditNote({
    invoiceId,
    items,
    notes,
    metadata = {}
  }: CreateCreditNoteParams) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        items: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Calculate refund amount
    const refundAmount = items.reduce((total, item) => {
      const invoiceItem = invoice.items.find(i => i.id === item.invoiceItemId);
      if (!invoiceItem) {
        throw new Error(`Invoice item ${item.invoiceItemId} not found`);
      }
      return total + (invoiceItem.unitPrice * item.quantity);
    }, 0);

    // Calculate tax
    const tax = await this.taxService.calculateTax({
      amount: refundAmount,
      countryCode: invoice.organization.country,
      stateCode: invoice.organization.state,
      customerType: invoice.organization.type,
      vatNumber: invoice.organization.vatNumber
    });

    // Generate credit note number
    const creditNoteNumber = await this.generateCreditNoteNumber();

    // Create credit note
    const creditNote = await prisma.creditNote.create({
      data: {
        number: creditNoteNumber,
        invoiceId,
        organizationId: invoice.organizationId,
        amount: refundAmount,
        taxAmount: tax.taxAmount,
        totalAmount: refundAmount + tax.taxAmount,
        currency: invoice.currency,
        notes,
        metadata,
        items: {
          create: items.map(item => {
            const invoiceItem = invoice.items.find(i => i.id === item.invoiceItemId)!;
            return {
              invoiceItemId: item.invoiceItemId,
              description: `Refund: ${invoiceItem.description}`,
              quantity: item.quantity,
              unitPrice: invoiceItem.unitPrice,
              amount: invoiceItem.unitPrice * item.quantity,
              reason: item.reason
            };
          })
        }
      }
    });

    // Generate PDF
    const pdf = await this.generateCreditNotePDF(creditNote);
    await this.storePDF(creditNote.id, pdf, 'credit-note');

    // Send notifications
    await this.notificationService.sendNotification({
      userId: invoice.organization.userId,
      title: 'Credit Note Generated',
      message: `Credit Note #${creditNote.number} for ${this.currencyService.format(creditNote.totalAmount, creditNote.currency)} has been generated.`,
      type: 'INFO',
      channels: ['EMAIL', 'IN_APP']
    });

    return creditNote;
  }

  /**
   * Generate a unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Get the latest invoice number for this month
    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        number: {
          startsWith: `INV-${year}${month}`
        }
      },
      orderBy: {
        number: 'desc'
      }
    });

    let sequence = 1;
    if (latestInvoice) {
      const lastSequence = parseInt(latestInvoice.number.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `INV-${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Generate a unique credit note number
   */
  private async generateCreditNoteNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Get the latest credit note number for this month
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

    return `CN-${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Generate PDF for invoice
   */
  private async generateInvoicePDF(invoice: any): Promise<Buffer> {
    const templateData = await this.prepareInvoiceTemplateData(invoice);
    return generatePDF('invoice', templateData);
  }

  /**
   * Generate PDF for credit note
   */
  private async generateCreditNotePDF(creditNote: any): Promise<Buffer> {
    const templateData = await this.prepareCreditNoteTemplateData(creditNote);
    return generatePDF('credit-note', templateData);
  }

  /**
   * Store generated PDF
   */
  private async storePDF(
    id: string,
    pdf: Buffer,
    type: 'invoice' | 'credit-note' = 'invoice'
  ): Promise<void> {
    // Implementation would store PDF in cloud storage
    // This is a placeholder that would be replaced with actual storage logic
    console.log(`Storing ${type} PDF for ID: ${id}`);
  }

  /**
   * Prepare template data for invoice PDF
   */
  private async prepareInvoiceTemplateData(invoice: any): Promise<any> {
    const organization = await prisma.organization.findUnique({
      where: { id: invoice.organizationId }
    });

    return {
      invoiceNumber: invoice.number,
      date: invoice.createdAt,
      dueDate: invoice.dueDate,
      organization: {
        name: organization?.name,
        address: organization?.address,
        vatNumber: organization?.vatNumber
      },
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      notes: invoice.notes
    };
  }

  /**
   * Prepare template data for credit note PDF
   */
  private async prepareCreditNoteTemplateData(creditNote: any): Promise<any> {
    const organization = await prisma.organization.findUnique({
      where: { id: creditNote.organizationId }
    });

    return {
      creditNoteNumber: creditNote.number,
      date: creditNote.createdAt,
      organization: {
        name: organization?.name,
        address: organization?.address,
        vatNumber: organization?.vatNumber
      },
      items: creditNote.items,
      amount: creditNote.amount,
      taxAmount: creditNote.taxAmount,
      totalAmount: creditNote.totalAmount,
      currency: creditNote.currency,
      notes: creditNote.notes
    };
  }
}