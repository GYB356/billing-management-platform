/**
 * Enhanced invoice service with multi-currency support and customizable templates
 */

import { prisma } from '../prisma';
import { CurrencyService } from './currency-service';
import { TaxService } from './tax-service';
import { createEvent, EventSeverity } from '../events';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { Invoice, InvoiceItem, InvoiceStatus } from '@prisma/client';
import { stripe } from '@/lib/stripe';
import { Organization, Customer, TaxRate } from '@prisma/client';
import { calculateTaxes } from './tax-service';
import PDFDocument from 'pdfkit';
import { formatCurrency } from '@/lib/utils/format';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  amount: number;
  totalAmount?: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface InvoiceCustomField {
  key: string;
  label: string;
  value: string;
}

export interface InvoiceData {
  organizationId: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceNumber: string;
  currency: string;
  items: InvoiceLineItem[];
  dueDate: Date;
  status: InvoiceStatus;
  notes?: string;
  metadata?: Record<string, any>;
  customFields?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  alternativeCurrencies?: string[];
}

export interface InvoiceTemplateOptions {
  logo?: Buffer;
  primaryColor?: string;
  secondaryColor?: string;
  font?: string;
  template?: 'standard' | 'modern' | 'minimal';
  showTaxDetails?: boolean;
  showPaymentInstructions?: boolean;
  paymentInstructions?: string;
  footerText?: string;
  headerText?: string;
  dateFormat?: string;
  locale?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    swift?: string;
    iban?: string;
  };
  digitalSignature?: {
    enabled: boolean;
    signatureImage?: Buffer;
    signedBy?: string;
    position?: string;
    date?: Date;
  };
  qrCodePayment?: {
    enabled: boolean;
    includeAmount?: boolean;
    instructions?: string;
  };
  showExchangeRates?: boolean;
  showTaxBreakdown?: boolean;
}

export interface InvoiceWithDetails extends Invoice {
  organization: Organization;
  customer: Customer;
  taxes: {
    id: string;
    name: string;
    rate: number;
    amount: number;
  }[];
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

export interface CreateInvoiceParams {
  organizationId: string;
  customerId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number; // Price in cents
  }[];
  dueDate?: Date;
  notes?: string;
  metadata?: Record<string, any>;
}

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(params: CreateInvoiceParams): Promise<InvoiceWithDetails> {
    const { 
      organizationId, 
      customerId, 
      items, 
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes,
      metadata
    } = params;

    // Retrieve organization and customer
    const [organization, customer] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.customer.findUnique({ where: { id: customerId } })
    ]);

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Calculate subtotal
    const subtotal = items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);

    // Get applicable tax rates
    const applicableTaxRates = await prisma.taxRate.findMany({
      where: {
        organizationId,
        isActive: true,
        country: customer.country || '',
        OR: [
          { state: null, city: null },
          { state: customer.state || '', city: null },
          { state: customer.state || '', city: customer.city || '' }
        ]
      }
    });

    // Check for tax exemptions
    const taxExemptions = await prisma.taxExemption.findMany({
      where: {
        customerId,
        organizationId,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } }
        ]
      },
      include: {
        taxRate: true
      }
    });

    const exemptTaxRateIds = taxExemptions.map(exemption => exemption.taxRateId);

    // Filter out exempt tax rates
    const taxRatesToApply = applicableTaxRates.filter(
      rate => !exemptTaxRateIds.includes(rate.id)
    );

    // Calculate taxes
    const taxes = calculateTaxes(subtotal, taxRatesToApply);
    
    // Calculate total
    const total = subtotal + taxes.reduce((sum, tax) => sum + tax.amount, 0);

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count({
      where: { organizationId }
    });
    
    const invoiceNumber = `INV-${organization.id.substring(0, 5)}-${(invoiceCount + 1).toString().padStart(6, '0')}`;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        customerId,
        number: invoiceNumber,
        status: 'draft',
        dueDate,
        subtotal,
        total,
        notes,
        metadata,
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice
          }))
        },
        taxes: {
          create: taxes.map(tax => ({
            taxRateId: tax.id,
            amount: tax.amount,
            isExempt: false
          }))
        }
      },
      include: {
        organization: true,
        customer: true,
        taxes: {
          include: {
            taxRate: true
          }
        },
        items: true
      }
    });

    // Transform to return the expected structure
    const invoiceWithDetails: InvoiceWithDetails = {
      ...invoice,
      taxes: invoice.taxes.map(tax => ({
        id: tax.taxRateId,
        name: tax.taxRate.name,
        rate: tax.taxRate.rate,
        amount: tax.amount
      })),
      items: invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }))
    };

    return invoiceWithDetails;
  }

  /**
   * Finalize an invoice
   */
  static async finalizeInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        customer: true,
        taxes: {
          include: {
            taxRate: true
          }
        },
        items: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be finalized');
    }

    // Update invoice status
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'open',
        finalizedAt: new Date()
      },
      include: {
        organization: true,
        customer: true,
        taxes: {
          include: {
            taxRate: true
          }
        },
        items: true
      }
    });

    // Create Stripe invoice if organization has Stripe customer ID
    if (invoice.organization.stripeCustomerId && invoice.customer.stripeCustomerId) {
      try {
        const stripeInvoiceItems = invoice.items.map(item => ({
          customer: invoice.customer.stripeCustomerId,
          price_data: {
            currency: 'usd', // TODO: Support multiple currencies
            product_data: {
              name: item.description,
              metadata: {
                invoiceItemId: item.id
              }
            },
            unit_amount: item.unitPrice,
          },
          quantity: item.quantity,
        }));

        // Create Stripe invoice items
        for (const item of stripeInvoiceItems) {
          await stripe.invoiceItems.create(item);
        }

        // Create Stripe invoice
        const stripeInvoice = await stripe.invoices.create({
          customer: invoice.customer.stripeCustomerId,
          auto_advance: true, // Auto-finalize and send the invoice
          collection_method: 'send_invoice',
          due_date: Math.floor(invoice.dueDate.getTime() / 1000),
          metadata: {
            invoiceId: invoice.id
          },
          footer: invoice.notes || undefined
        });

        // Update our invoice with Stripe ID
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            stripeInvoiceId: stripeInvoice.id
          }
        });
      } catch (error) {
        console.error('Error creating Stripe invoice:', error);
        // Don't throw error, continue with local invoice
      }
    }

    // Transform to return the expected structure
    const invoiceWithDetails: InvoiceWithDetails = {
      ...updatedInvoice,
      taxes: updatedInvoice.taxes.map(tax => ({
        id: tax.taxRateId,
        name: tax.taxRate.name,
        rate: tax.taxRate.rate,
        amount: tax.amount
      })),
      items: updatedInvoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }))
    };

    return invoiceWithDetails;
  }

  /**
   * Generate PDF for an invoice
   */
  static async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        customer: true,
        taxes: {
          include: {
            taxRate: true
          }
        },
        items: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    // Collect PDF data chunks
    doc.on('data', buffers.push.bind(buffers));

    // Add company logo and info
    doc
      .fontSize(20)
      .text(invoice.organization.name, { align: 'right' })
      .fontSize(12)
      .text(invoice.organization.address || '', { align: 'right' })
      .text(
        [
          invoice.organization.city,
          invoice.organization.state,
          invoice.organization.postalCode
        ].filter(Boolean).join(', '),
        { align: 'right' }
      )
      .text(invoice.organization.country || '', { align: 'right' })
      .text(`Tax ID: ${invoice.organization.taxId || 'N/A'}`, { align: 'right' })
      .moveDown(2);

    // Add invoice information
    doc
      .fontSize(24)
      .text('INVOICE', { align: 'center' })
      .moveDown()
      .fontSize(12)
      .text(`Invoice Number: ${invoice.number}`, { align: 'left' })
      .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'left' })
      .text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, { align: 'left' })
      .moveDown(0.5);

    // Add customer information
    doc
      .fontSize(14)
      .text('Bill To:', { align: 'left' })
      .fontSize(12)
      .text(invoice.customer.name, { align: 'left' })
      .text(invoice.customer.address || '', { align: 'left' })
      .text(
        [
          invoice.customer.city,
          invoice.customer.state,
          invoice.customer.postalCode
        ].filter(Boolean).join(', '),
        { align: 'left' }
      )
      .text(invoice.customer.country || '', { align: 'left' })
      .text(`Tax ID: ${invoice.customer.taxId || 'N/A'}`, { align: 'left' })
      .moveDown(2);

    // Add items table
    const tableTop = doc.y;
    const itemX = 50;
    const descriptionX = 100;
    const quantityX = 300;
    const priceX = 350;
    const totalX = 450;

    // Add table headers
    doc
      .fontSize(12)
      .text('Item', itemX, tableTop, { width: 50 })
      .text('Description', descriptionX, tableTop, { width: 200 })
      .text('Qty', quantityX, tableTop, { width: 50 })
      .text('Price', priceX, tableTop, { width: 100 })
      .text('Total', totalX, tableTop, { width: 100 });

    // Add horizontal line
    doc
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke();

    // Add items
    let y = tableTop + 30;
    invoice.items.forEach((item, index) => {
      doc
        .fontSize(12)
        .text((index + 1).toString(), itemX, y, { width: 50 })
        .text(item.description, descriptionX, y, { width: 200 })
        .text(item.quantity.toString(), quantityX, y, { width: 50 })
        .text(formatCurrency(item.unitPrice / 100), priceX, y, { width: 100 })
        .text(formatCurrency(item.total / 100), totalX, y, { width: 100 });
      
      y += 20;
    });

    // Add horizontal line
    doc
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
    
    y += 20;

    // Add subtotal
    doc
      .fontSize(12)
      .text('Subtotal:', 350, y, { width: 100 })
      .text(formatCurrency(invoice.subtotal / 100), totalX, y, { width: 100 });
    
    y += 20;

    // Add taxes
    invoice.taxes.forEach(tax => {
      doc
        .fontSize(12)
        .text(`${tax.taxRate.name} (${tax.taxRate.rate}%):`, 350, y, { width: 100 })
        .text(formatCurrency(tax.amount / 100), totalX, y, { width: 100 });
      
      y += 20;
    });

    // Add total
    doc
      .fontSize(14)
      .text('Total:', 350, y, { width: 100 })
      .text(formatCurrency(invoice.total / 100), totalX, y, { width: 100 });

    // Add notes if any
    if (invoice.notes) {
      y += 40;
      doc
        .fontSize(12)
        .text('Notes:', 50, y, { width: 150 })
        .text(invoice.notes, 50, y + 20, { width: 500 });
    }

    // Add footer
    const bottomY = doc.page.height - 50;
    doc
      .fontSize(10)
      .text(
        'Thank you for your business!',
        50,
        bottomY,
        { align: 'center', width: 500 }
      );

    // Finalize the PDF
    doc.end();

    // Return the PDF as a buffer
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  /**
   * Generate PDF invoice
   */
  static async generatePDF(invoiceId: string, options: InvoiceTemplateOptions = {}): Promise<Buffer> {
    // Get invoice with related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        items: true,
        customer: true,
        subscription: true,
        payments: true
      }
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size

    // Generate basic PDF content
    const { width, height } = page.getSize();
    
    // Add title
    page.drawText('INVOICE', {
      x: width / 2 - 50,
      y: height - 50,
      size: 24
    });
    
    // Add invoice number
    page.drawText(`Invoice #: ${invoice.number}`, {
      x: 50,
      y: height - 100,
      size: 12
    });
    
    // Add date
    page.drawText(`Date: ${format(invoice.createdAt, 'yyyy-MM-dd')}`, {
      x: 50,
      y: height - 120,
      size: 12
    });
    
    // Add items
    page.drawText('Items:', {
      x: 50,
      y: height - 180,
      size: 14
    });
    
    let y = height - 210;
    for (const item of invoice.items) {
      page.drawText(
        `${item.description} x ${item.quantity} @ ${CurrencyService.formatCurrency(item.unitPrice, invoice.currency)} = ${CurrencyService.formatCurrency(item.amount, invoice.currency)}`,
        {
          x: 50,
          y,
          size: 10
        }
      );
      y -= 20;
    }
    
    // Add totals
    page.drawText(`Subtotal: ${CurrencyService.formatCurrency(invoice.subtotal, invoice.currency)}`, {
      x: 350,
      y: height - 500,
      size: 12
    });
    
    page.drawText(`Tax (${invoice.taxRate}%): ${CurrencyService.formatCurrency(invoice.taxAmount, invoice.currency)}`, {
      x: 350,
      y: height - 520,
      size: 12
    });
    
    page.drawText(`Total: ${CurrencyService.formatCurrency(invoice.totalAmount, invoice.currency)}`, {
      x: 350,
      y: height - 540,
      size: 14
    });

    // Add exchange rates if enabled and available
    if (options.showExchangeRates && invoice.metadata?.alternativeCurrencies) {
      y = height - 580;
      page.drawText('Exchange Rates:', {
        x: 50,
        y,
        size: 12
      });
      y -= 20;

      for (const altCurrency of invoice.metadata.alternativeCurrencies) {
        const rate = await CurrencyService.getExchangeRate(invoice.currency, altCurrency);
        const convertedAmount = await CurrencyService.convertAmount(invoice.totalAmount, invoice.currency, altCurrency);
        
        page.drawText(
          `${altCurrency}: ${CurrencyService.formatCurrency(convertedAmount, altCurrency)} (Rate: ${rate.toFixed(4)})`,
          {
            x: 50,
            y,
            size: 10
          }
        );
        y -= 15;
      }
    }
    
    // Add tax breakdown if enabled
    if (options.showTaxBreakdown && invoice.metadata?.taxBreakdown) {
      y = height - 650;
      page.drawText('Tax Breakdown:', {
        x: 50,
        y,
        size: 12
      });
      y -= 20;

      const taxBreakdown = invoice.metadata.taxBreakdown;
      if (taxBreakdown.vat) {
        page.drawText(`VAT: ${CurrencyService.formatCurrency(taxBreakdown.vat, invoice.currency)}`, {
          x: 50,
          y,
          size: 10
        });
        y -= 15;
      }
      if (taxBreakdown.gst) {
        page.drawText(`GST: ${CurrencyService.formatCurrency(taxBreakdown.gst, invoice.currency)}`, {
          x: 50,
          y,
          size: 10
        });
        y -= 15;
      }
      if (taxBreakdown.salesTax) {
        page.drawText(`Sales Tax: ${CurrencyService.formatCurrency(taxBreakdown.salesTax, invoice.currency)}`, {
          x: 50,
          y,
          size: 10
        });
        y -= 15;
      }
    }
    
    // Add QR code if enabled
    if (options.qrCodePayment?.enabled) {
      try {
        // Generate payment data for QR code
        const paymentData = JSON.stringify({
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          currency: invoice.currency
        });
        
        // Generate QR code
        const qrCodeDataUrl = await QRCode.toDataURL(paymentData);
        const qrCodeData = qrCodeDataUrl.split(',')[1];
        const qrCodeImage = await pdfDoc.embedPng(Buffer.from(qrCodeData, 'base64'));
        
        // Draw QR code
        page.drawImage(qrCodeImage, {
          x: 50,
          y: 100,
          width: 100,
          height: 100
        });
        
        // Add instructions
        if (options.qrCodePayment.instructions) {
          page.drawText(options.qrCodePayment.instructions, {
            x: 160,
            y: 150,
            size: 10
          });
        }
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }

    return pdfDoc.save();
  }

  /**
   * Send invoice by email
   */
  static async sendInvoiceByEmail(invoiceId: string, emailTo: string, options: InvoiceTemplateOptions = {}): Promise<void> {
    // In a real implementation, this would connect to an email service like Sendgrid, Mailgun, etc.
    console.log(`Sending invoice ${invoiceId} to ${emailTo} (implementation needed)`);
  }

  /**
   * Mark invoice as paid
   */
  static async markAsPaid(invoiceId: string, paymentId: string, paidAmount: number): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAmount,
        paidAt: new Date(),
        payments: {
          connect: {
            id: paymentId
          }
        }
      }
    });
  }

  /**
   * Get invoice history for an organization
   */
  static async getInvoiceHistory(
    organizationId: string,
    filters: {
      status?: InvoiceStatus | InvoiceStatus[];
      dateFrom?: Date;
      dateTo?: Date;
      customerId?: string;
      subscriptionId?: string;
    } = {},
    pagination: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { organizationId };
    
    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }
    
    if (filters.customerId) {
      where.customerId = filters.customerId;
    }
    
    if (filters.subscriptionId) {
      where.subscriptionId = filters.subscriptionId;
    }

    // Get invoices with count
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          items: true,
          payments: true,
          customer: true,
          subscription: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.invoice.count({ where })
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get invoice summary statistics
   */
  static async getInvoiceSummary(organizationId: string, period: 'month' | 'quarter' | 'year' = 'month') {
    // Determine date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get invoice statistics
    const [totalInvoiced, totalPaid, overdue] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        },
        _sum: {
          totalAmount: true
        }
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: 'PAID',
          createdAt: { gte: startDate }
        },
        _sum: {
          paidAmount: true
        }
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: 'OVERDUE',
          createdAt: { gte: startDate }
        },
        _sum: {
          totalAmount: true
        },
        _count: true
      })
    ]);

    return {
      period,
      totalInvoiced: totalInvoiced._sum.totalAmount || 0,
      totalPaid: totalPaid._sum.paidAmount || 0,
      overdue: {
        amount: overdue._sum.totalAmount || 0,
        count: overdue._count
      }
    };
  }
} 