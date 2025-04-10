import { prisma } from '@/lib/prisma';
import { CurrencyService } from './currency-service';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createEvent } from '@/lib/events';
import { Organization } from '@prisma/client';

interface LocalizedInvoiceTemplate {
  language: string;
  region: string;
  template: {
    header: string;
    footer: string;
    dateFormat: string;
    labels: Record<string, string>;
    layout: 'standard' | 'compact' | 'detailed';
    taxDisplay: 'inclusive' | 'exclusive' | 'itemized';
    requiredFields: string[];
  };
}

interface TaxRule {
  region: string;
  type: 'VAT' | 'GST' | 'SALES_TAX';
  rules: Array<{
    condition: (amount: number, customer: any) => boolean;
    rate: number;
    category?: string;
    isCompound?: boolean;
  }>;
  displayRules: {
    showOnInvoice: boolean;
    separateLines: boolean;
    format: string;
  };
}

export class LocalizedInvoiceService {
  private static readonly templates: Record<string, LocalizedInvoiceTemplate> = {
    'en-US': {
      language: 'en',
      region: 'US',
      template: {
        header: 'INVOICE',
        footer: 'Thank you for your business',
        dateFormat: 'MM/dd/yyyy',
        labels: {
          invoiceNumber: 'Invoice #',
          date: 'Date',
          dueDate: 'Due Date',
          subtotal: 'Subtotal',
          tax: 'Tax',
          total: 'Total',
        },
        layout: 'standard',
        taxDisplay: 'exclusive',
        requiredFields: ['businessName', 'taxId'],
      },
    },
    'de-DE': {
      language: 'de',
      region: 'DE',
      template: {
        header: 'RECHNUNG',
        footer: 'Vielen Dank für Ihren Auftrag',
        dateFormat: 'dd.MM.yyyy',
        labels: {
          invoiceNumber: 'Rechnungsnummer',
          date: 'Datum',
          dueDate: 'Fälligkeitsdatum',
          subtotal: 'Zwischensumme',
          tax: 'MwSt.',
          total: 'Gesamtbetrag',
        },
        layout: 'detailed',
        taxDisplay: 'inclusive',
        requiredFields: ['businessName', 'taxId', 'vatId'],
      },
    },
    // Add more localized templates
  };

  private static readonly taxRules: Record<string, TaxRule> = {
    EU: {
      region: 'EU',
      type: 'VAT',
      rules: [
        {
          condition: (amount, customer) => customer.type === 'business' && !customer.sameCountry,
          rate: 0, // Reverse charge
        },
        {
          condition: (amount, customer) => customer.type === 'business' && customer.sameCountry,
          rate: 0.20, // Standard VAT rate
        },
        {
          condition: (amount, customer) => customer.type === 'individual',
          rate: 0.20, // Standard VAT rate
        },
      ],
      displayRules: {
        showOnInvoice: true,
        separateLines: true,
        format: '{rate}% {type}',
      },
    },
    US: {
      region: 'US',
      type: 'SALES_TAX',
      rules: [
        {
          condition: (amount, customer) => customer.type === 'business' && customer.taxExempt,
          rate: 0,
        },
        {
          condition: () => true,
          rate: 0.0725, // Example CA rate
        },
      ],
      displayRules: {
        showOnInvoice: true,
        separateLines: false,
        format: '{type} ({rate}%)',
      },
    },
    // Add more regional tax rules
  };

  static async generateInvoice(
    invoiceData: any,
    organization: Organization,
    options: {
      language?: string;
      currency?: string;
      template?: string;
    } = {}
  ): Promise<Buffer> {
    const locale = options.language || organization.defaultLanguage || 'en-US';
    const template = this.templates[locale] || this.templates['en-US'];
    const taxRule = this.getTaxRuleForRegion(organization.country);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Format currency amounts
    const formattedAmounts = await this.formatAmounts(
      invoiceData.amounts,
      options.currency || organization.defaultCurrency,
      locale
    );

    // Calculate taxes
    const taxCalculation = await this.calculateTax(
      invoiceData.amounts.subtotal,
      organization,
      invoiceData.customer
    );

    // Generate PDF content
    await this.generatePDFContent(page, {
      template,
      font,
      data: {
        ...invoiceData,
        amounts: formattedAmounts,
        tax: taxCalculation,
      },
      organization,
    });

    // Log invoice generation
    await this.logInvoiceGeneration(invoiceData.id, {
      locale,
      currency: options.currency,
      template: template.region,
    });

    return Buffer.from(await pdfDoc.save());
  }

  private static async formatAmounts(
    amounts: Record<string, number>,
    currency: string,
    locale: string
  ): Promise<Record<string, string>> {
    const formatted: Record<string, string> = {};
    
    for (const [key, amount] of Object.entries(amounts)) {
      formatted[key] = await CurrencyService.formatCurrencyForLocale(
        amount,
        currency,
        locale,
        { displayCurrency: true }
      );
    }
    
    return formatted;
  }

  private static async calculateTax(
    amount: number,
    organization: Organization,
    customer: any
  ): Promise<{
    total: number;
    details: Array<{
      type: string;
      rate: number;
      amount: number;
      description: string;
    }>;
  }> {
    const taxRule = this.getTaxRuleForRegion(organization.country);
    const details: Array<{
      type: string;
      rate: number;
      amount: number;
      description: string;
    }> = [];
    let totalTax = 0;

    for (const rule of taxRule.rules) {
      if (rule.condition(amount, customer)) {
        const taxAmount = amount * rule.rate;
        totalTax += taxAmount;

        if (taxRule.displayRules.showOnInvoice) {
          details.push({
            type: taxRule.type,
            rate: rule.rate,
            amount: taxAmount,
            description: taxRule.displayRules.format
              .replace('{rate}', (rule.rate * 100).toFixed(2))
              .replace('{type}', taxRule.type),
          });
        }
      }
    }

    return {
      total: totalTax,
      details,
    };
  }

  private static getTaxRuleForRegion(country: string): TaxRule {
    if (this.isEUCountry(country)) {
      return this.taxRules.EU;
    }
    return this.taxRules[country] || this.taxRules.US;
  }

  private static isEUCountry(country: string): boolean {
    return CurrencyService.isEUCountry(country);
  }

  private static async generatePDFContent(
    page: any,
    config: {
      template: LocalizedInvoiceTemplate;
      font: any;
      data: any;
      organization: Organization;
    }
  ): Promise<void> {
    const { width, height } = page.getSize();
    const { template, font, data, organization } = config;

    // Add header
    page.drawText(template.header, {
      x: 50,
      y: height - 50,
      font,
      size: 24,
    });

    // Add organization details
    let yPosition = height - 120;
    for (const field of template.requiredFields) {
      const value = organization[field as keyof Organization];
      if (value) {
        page.drawText(`${field}: ${value}`, {
          x: 50,
          y: yPosition,
          font,
          size: 12,
        });
        yPosition -= 20;
      }
    }

    // Add invoice details, amounts, and tax information
    // Implementation details depend on specific template layout requirements
    
    // Add footer
    page.drawText(template.footer, {
      x: 50,
      y: 50,
      font,
      size: 10,
    });
  }

  private static async logInvoiceGeneration(
    invoiceId: string,
    metadata: {
      locale: string;
      currency?: string;
      template: string;
    }
  ): Promise<void> {
    await createEvent({
      eventType: 'INVOICE_GENERATED',
      resourceId: invoiceId,
      resourceType: 'INVOICE',
      metadata,
    });
  }
}