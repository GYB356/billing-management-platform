import { prisma } from '../prisma';
import { stripe } from '../stripe';
import { TaxJar } from 'taxjar';
import { CurrencyService } from '../currency';

const taxjar = new TaxJar({
  apiKey: process.env.TAXJAR_API_KEY || '',
});

export class TaxService {
  static async calculateTax(params: {
    amount: number;
    fromCountry: string;
    fromZip: string;
    fromState: string;
    toCountry: string;
    toZip: string;
    toState: string;
    shipping: number;
    customerId: string;
  }) {
    try {
      // Get customer's tax exemption status
      const customer = await prisma.customer.findUnique({
        where: { id: params.customerId },
        select: { taxExempt: true, taxIds: true }
      });

      if (customer?.taxExempt) {
        return { taxAmount: 0, details: { exempt: true } };
      }

      // Calculate tax using TaxJar
      const tax = await taxjar.taxForOrder({
        amount: params.amount,
        shipping: params.shipping,
        from_country: params.fromCountry,
        from_zip: params.fromZip,
        from_state: params.fromState,
        to_country: params.toCountry,
        to_zip: params.toZip,
        to_state: params.toState,
        customer_id: params.customerId
      });

      // Store tax calculation for audit
      await prisma.taxCalculation.create({
        data: {
          customerId: params.customerId,
          amount: params.amount,
          taxAmount: tax.tax.amount_to_collect,
          details: tax,
          createdAt: new Date()
        }
      });

      return {
        taxAmount: tax.tax.amount_to_collect,
        details: tax
      };
    } catch (error) {
      console.error('Tax calculation error:', error);
      throw new Error('Failed to calculate tax');
    }
  }

  static async validateTaxId(taxId: string, country: string) {
    try {
      // Validate VAT number for EU countries
      if (country.startsWith('EU')) {
        const response = await fetch(
          `https://api.vatlayer.com/validate?access_key=${process.env.VATLAYER_API_KEY}&vat_number=${taxId}`
        );
        const data = await response.json();
        return data.valid;
      }

      // For US, validate EIN format
      if (country === 'US') {
        return /^\d{2}-\d{7}$/.test(taxId);
      }

      return true;
    } catch (error) {
      console.error('Tax ID validation error:', error);
      throw new Error('Failed to validate tax ID');
    }
  }

  static async generateTaxReport(organizationId: string, month: Date) {
    try {
      const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
      const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const taxCalculations = await prisma.taxCalculation.findMany({
        where: {
          customer: {
            organizationId
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          customer: true
        }
      });

      const report = {
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalTax: 0,
          byCountry: {} as Record<string, number>,
          byTaxType: {} as Record<string, number>
        },
        details: taxCalculations
      };

      taxCalculations.forEach(calc => {
        report.summary.totalTax += calc.taxAmount;
        report.summary.byCountry[calc.customer.country] = 
          (report.summary.byCountry[calc.customer.country] || 0) + calc.taxAmount;
      });

      return report;
    } catch (error) {
      console.error('Tax report generation error:', error);
      throw new Error('Failed to generate tax report');
    }
  }
}
