import { prisma } from './prisma';
import { CurrencyService } from './currency';
import { calculateTaxWithExemptions } from './tax';
import { createEvent, EventSeverity } from './events';
import { PDFGenerator } from './pdf-generator';
import { formatDate } from './date-utils';

export interface InvoiceItem {
  description: string;
  amount: number;
  currency: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  organizationId: string;
  items: InvoiceItem[];
  currency: string;
  dueDate: Date;
  notes?: string;
  metadata?: Record<string, any>;
}

export class InvoiceGenerator {
  static async generateInvoice(data: InvoiceData) {
    try {
      // Get organization details
      const organization = await prisma.organization.findUnique({
        where: { id: data.organizationId },
        include: {
          settings: true
        }
      });

      if (!organization) {
        throw new Error(`Organization with ID ${data.organizationId} not found`);
      }

      // Calculate subtotal in the invoice's currency
      const subtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        return sum + itemTotal;
      }, 0);

      // Get tax settings and calculate tax
      const taxSettings = await prisma.organization.findUnique({
        where: { id: data.organizationId },
        select: {
          taxExempt: true,
          taxId: true,
          settings: true
        }
      });

      const taxResult = await calculateTaxWithExemptions({
        amount: subtotal,
        currency: data.currency,
        country: organization.settings?.taxCountry || 'US',
        state: organization.settings?.taxState,
        taxExempt: taxSettings?.taxExempt || false,
        taxId: taxSettings?.taxId,
        organizationId: data.organizationId
      });

      // Create invoice in database
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          organizationId: data.organizationId,
          subtotal: subtotal,
          taxRate: taxResult.taxRate,
          taxAmount: taxResult.taxAmount,
          totalAmount: taxResult.totalAmount,
          currency: data.currency,
          status: 'PENDING',
          dueDate: data.dueDate,
          notes: data.notes,
          metadata: data.metadata,
          items: {
            create: data.items.map(item => ({
              description: item.description,
              amount: item.amount,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || taxResult.taxRate,
              taxAmount: Math.round((item.amount * (item.taxRate || taxResult.taxRate)) / 100),
              totalAmount: item.amount + Math.round((item.amount * (item.taxRate || taxResult.taxRate)) / 100)
            }))
          }
        }
      });

      // Log invoice creation event
      await createEvent({
        eventType: 'INVOICE_CREATED',
        resourceType: 'INVOICE',
        resourceId: invoice.id,
        severity: EventSeverity.INFO,
        metadata: {
          invoiceNumber: data.invoiceNumber,
          amount: taxResult.totalAmount,
          currency: data.currency,
          taxRate: taxResult.taxRate,
          taxAmount: taxResult.taxAmount
        }
      });

      return invoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      await createEvent({
        eventType: 'INVOICE_GENERATION_ERROR',
        resourceType: 'INVOICE',
        severity: EventSeverity.ERROR,
        metadata: {
          organizationId: data.organizationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  static async generateInvoicePDF(invoiceId: string, options: any = {}) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        items: true
      }
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    return PDFGenerator.generateInvoicePDF(invoice, options);
  }

  static async getInvoiceHistory(organizationId: string, filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    currency?: string;
  } = {}) {
    const where: any = { organizationId };

    if (filters.startDate) {
      where.createdAt = { gte: filters.startDate };
    }
    if (filters.endDate) {
      where.createdAt = { ...where.createdAt, lte: filters.endDate };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.currency) {
      where.currency = filters.currency;
    }

    return prisma.invoice.findMany({
      where,
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}