import PDFDocument from 'pdfkit';
import { Invoice, InvoiceItem, Organization } from '@prisma/client';
import { formatCurrency } from './currency';
import { formatDate } from './date-utils';

interface InvoiceWithRelations extends Invoice {
  organization: Organization;
  items: InvoiceItem[];
}

export interface PDFOptions {
  primaryColor?: string;
  secondaryColor?: string;
  font?: string;
  logo?: string | Buffer;
  includeTerms?: boolean;
  includeFooter?: boolean;
  customFooter?: string;
  language?: string;
  template?: 'standard' | 'modern' | 'minimal';
  customFields?: Array<{ key: string; label: string; value: string }>;
  digitalSignature?: {
    enabled: boolean;
    signedBy?: string;
    signedAt?: Date;
    signatureImage?: Buffer;
  };
  qrCodePayment?: {
    enabled: boolean;
    qrData?: string;
    instructions?: string;
  };
  taxBreakdown?: boolean;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    swift?: string;
    iban?: string;
  };
}

export class PDFGenerator {
  private static defaultOptions: PDFOptions = {
    primaryColor: '#000000',
    secondaryColor: '#666666',
    font: 'Helvetica',
    includeTerms: true,
    includeFooter: true,
    customFooter: 'Thank you for your business!',
    template: 'standard',
    taxBreakdown: false
  };

  static async generateInvoicePDF(invoice: InvoiceWithRelations, options: PDFOptions = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: invoice.organization.name
      }
    });

    // Set up the document
    doc.font(mergedOptions.font);

    // Apply template style
    switch (mergedOptions.template) {
      case 'modern':
        this.applyModernTemplate(doc, invoice, mergedOptions);
        break;
      case 'minimal':
        this.applyMinimalTemplate(doc, invoice, mergedOptions);
        break;
      case 'standard':
      default:
        this.applyStandardTemplate(doc, invoice, mergedOptions);
        break;
    }

    return doc;
  }

  private static applyStandardTemplate(doc: PDFKit.PDFDocument, invoice: InvoiceWithRelations, options: PDFOptions) {
    // Add logo if provided
    if (options.logo) {
      try {
        doc.image(options.logo, 50, 45, { width: 150 });
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    }

    // Company details
    doc.fontSize(20)
       .fillColor(options.primaryColor)
       .text(invoice.organization.name, 50, 120)
       .fontSize(10)
       .fillColor(options.secondaryColor);

    if (invoice.organization.address) {
      doc.text(invoice.organization.address, 50, 140);
    }
    if (invoice.organization.email) {
      doc.text(invoice.organization.email, 50, 155);
    }
    if (invoice.organization.phone) {
      doc.text(invoice.organization.phone, 50, 170);
    }

    // Invoice details
    doc.fontSize(20)
       .fillColor(options.primaryColor)
       .text('INVOICE', 400, 120)
       .fontSize(10)
       .fillColor(options.secondaryColor)
       .text(`Invoice Number: ${invoice.invoiceNumber}`, 400, 140)
       .text(`Date: ${formatDate(invoice.createdAt)}`, 400, 155)
       .text(`Due Date: ${formatDate(invoice.dueDate)}`, 400, 170);

    // Custom fields
    let currentY = 185;
    if (options.customFields && options.customFields.length > 0) {
      options.customFields.forEach(field => {
        doc.text(`${field.label}: ${field.value}`, 400, currentY);
        currentY += 15;
      });
    }

    // Items table header
    const startY = Math.max(250, currentY + 30);
    doc.fontSize(12)
       .fillColor(options.primaryColor)
       .text('Description', 50, startY)
       .text('Quantity', 300, startY)
       .text('Unit Price', 400, startY)
       .text('Amount', 500, startY);

    // Items
    let itemsY = startY + 30;
    invoice.items.forEach(item => {
      doc.fontSize(10)
         .fillColor('#000000')
         .text(item.description, 50, itemsY)
         .text(item.quantity.toString(), 300, itemsY)
         .text(formatCurrency(item.unitPrice, invoice.currency), 400, itemsY)
         .text(formatCurrency(item.amount, invoice.currency), 500, itemsY);
      itemsY += 20;
    });

    // Totals
    itemsY += 20;
    doc.fontSize(10)
       .fillColor(options.secondaryColor)
       .text('Subtotal:', 400, itemsY)
       .text(formatCurrency(invoice.subtotal, invoice.currency), 500, itemsY);

    itemsY += 20;
    doc.text('Tax:', 400, itemsY)
       .text(`${invoice.taxRate}%`, 450, itemsY)
       .text(formatCurrency(invoice.taxAmount, invoice.currency), 500, itemsY);

    // Tax breakdown if enabled
    if (options.taxBreakdown && invoice.metadata?.taxBreakdown) {
      const taxBreakdown = invoice.metadata.taxBreakdown as Array<{
        name: string;
        rate: number;
        amount: number;
      }>;
      
      if (taxBreakdown && taxBreakdown.length > 0) {
        itemsY += 20;
        doc.text('Tax Breakdown:', 400, itemsY);
        
        taxBreakdown.forEach(tax => {
          itemsY += 15;
          doc.text(`- ${tax.name} (${tax.rate}%)`, 400, itemsY)
             .text(formatCurrency(tax.amount, invoice.currency), 500, itemsY);
        });
      }
    }

    itemsY += 20;
    doc.fontSize(12)
       .fillColor(options.primaryColor)
       .text('Total:', 400, itemsY)
       .text(formatCurrency(invoice.totalAmount, invoice.currency), 500, itemsY);

    // Alternative currency if present
    if (invoice.metadata?.alternativeCurrency) {
      const altCurrency = invoice.metadata.alternativeCurrency as {
        currency: string;
        exchangeRate: number;
        totalAmount: number;
      };
      
      itemsY += 20;
      doc.fontSize(10)
         .fillColor(options.secondaryColor)
         .text(`Also payable as:`, 400, itemsY);
      
      itemsY += 15;
      doc.text(`${formatCurrency(altCurrency.totalAmount, altCurrency.currency)}`, 400, itemsY)
         .text(`(Rate: 1 ${invoice.currency} = ${altCurrency.exchangeRate} ${altCurrency.currency})`, 400, itemsY + 15);
    }

    // Notes
    if (invoice.notes) {
      itemsY += 40;
      doc.fontSize(10)
         .fillColor(options.secondaryColor)
         .text('Notes:', 50, itemsY)
         .text(invoice.notes, 50, itemsY + 15, { width: 500 });
    }

    // Bank details if provided
    if (options.bankDetails) {
      itemsY += 60;
      doc.fontSize(10)
         .fillColor(options.primaryColor)
         .text('Payment Details:', 50, itemsY);
      
      itemsY += 15;
      doc.fillColor(options.secondaryColor);
      
      if (options.bankDetails.bankName) {
        doc.text(`Bank: ${options.bankDetails.bankName}`, 50, itemsY);
        itemsY += 15;
      }
      
      if (options.bankDetails.accountNumber) {
        doc.text(`Account: ${options.bankDetails.accountNumber}`, 50, itemsY);
        itemsY += 15;
      }
      
      if (options.bankDetails.routingNumber) {
        doc.text(`Routing: ${options.bankDetails.routingNumber}`, 50, itemsY);
        itemsY += 15;
      }
      
      if (options.bankDetails.swift) {
        doc.text(`SWIFT: ${options.bankDetails.swift}`, 50, itemsY);
        itemsY += 15;
      }
      
      if (options.bankDetails.iban) {
        doc.text(`IBAN: ${options.bankDetails.iban}`, 50, itemsY);
        itemsY += 15;
      }
    }

    // Digital signature if enabled
    if (options.digitalSignature?.enabled) {
      itemsY += 40;
      doc.fontSize(10)
         .fillColor(options.primaryColor)
         .text('Authorized Signature:', 400, itemsY);
      
      if (options.digitalSignature.signatureImage) {
        try {
          doc.image(options.digitalSignature.signatureImage, 400, itemsY + 10, { width: 100 });
          itemsY += 60;
        } catch (error) {
          console.error('Error adding signature image:', error);
          itemsY += 20;
        }
      } else {
        itemsY += 20;
      }
      
      doc.fillColor(options.secondaryColor)
         .text(`${options.digitalSignature.signedBy || 'Authorized Signatory'}`, 400, itemsY);
      
      if (options.digitalSignature.signedAt) {
        doc.text(`Date: ${formatDate(options.digitalSignature.signedAt)}`, 400, itemsY + 15);
      }
    }

    // QR code for payment if enabled
    if (options.qrCodePayment?.enabled && options.qrCodePayment.qrData) {
      try {
        // Generate QR code (this would typically be done externally)
        const qrPosition = itemsY + 40;
        doc.fontSize(10)
           .fillColor(options.primaryColor)
           .text('Scan to Pay:', 50, qrPosition);
        
        // Here you would add the QR code image
        // doc.image(qrCodeBuffer, 50, qrPosition + 15, { width: 100 });
        
        if (options.qrCodePayment.instructions) {
          doc.fillColor(options.secondaryColor)
             .text(options.qrCodePayment.instructions, 160, qrPosition + 15, { width: 300 });
        }
      } catch (error) {
        console.error('Error adding QR code:', error);
      }
    }

    // Terms and conditions
    if (options.includeTerms) {
      const termsY = doc.page.height - 150;
      doc.fontSize(8)
         .fillColor(options.secondaryColor)
         .text('Terms and Conditions:', 50, termsY)
         .text('1. Payment is due within 30 days of invoice date.', 50, termsY + 15)
         .text('2. Late payments will incur a 5% fee.', 50, termsY + 30)
         .text('3. All prices are exclusive of taxes unless otherwise stated.', 50, termsY + 45);
    }

    // Footer
    if (options.includeFooter) {
      doc.fontSize(8)
         .fillColor(options.secondaryColor)
         .text(options.customFooter, 50, doc.page.height - 50, { align: 'center' });
    }
  }

  private static applyModernTemplate(doc: PDFKit.PDFDocument, invoice: InvoiceWithRelations, options: PDFOptions) {
    // Header with background
    doc.rect(0, 0, doc.page.width, 150)
       .fill(options.primaryColor);
    
    // Add logo if provided
    if (options.logo) {
      try {
        doc.image(options.logo, 50, 45, { width: 150 });
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    }

    // Invoice title
    doc.fontSize(30)
       .fillColor('#FFFFFF')
       .text('INVOICE', 400, 50);
    
    doc.fontSize(12)
       .text(`#${invoice.invoiceNumber}`, 400, 85);

    // Company details
    doc.fontSize(12)
       .fillColor('#000000')
       .text('FROM', 50, 170)
       .fontSize(16)
       .text(invoice.organization.name, 50, 190)
       .fontSize(10)
       .fillColor(options.secondaryColor);

    let fromY = 215;
    if (invoice.organization.address) {
      doc.text(invoice.organization.address, 50, fromY);
      fromY += 15;
    }
    if (invoice.organization.email) {
      doc.text(invoice.organization.email, 50, fromY);
      fromY += 15;
    }
    if (invoice.organization.phone) {
      doc.text(invoice.organization.phone, 50, fromY);
    }

    // Invoice details
    doc.fontSize(12)
       .fillColor('#000000')
       .text('DETAILS', 350, 170);

    doc.fontSize(10)
       .fillColor(options.secondaryColor)
       .text(`Issue Date:`, 350, 190)
       .text(`Due Date:`, 350, 205)
       .text(`Amount Due:`, 350, 220);

    doc.fontSize(10)
       .fillColor('#000000')
       .text(formatDate(invoice.createdAt), 450, 190)
       .text(formatDate(invoice.dueDate), 450, 205)
       .text(formatCurrency(invoice.totalAmount, invoice.currency), 450, 220);

    // Rest of invoice implementation similar to standard template
    // ...
  }

  private static applyMinimalTemplate(doc: PDFKit.PDFDocument, invoice: InvoiceWithRelations, options: PDFOptions) {
    // Minimal template implementation
    // ...
  }
}