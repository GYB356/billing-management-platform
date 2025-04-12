<<<<<<< HEAD
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
=======
import prisma from '@/lib/prisma';
import { createEvent, EventType } from '@/lib/events';
import { 
  CustomerType, 
  TaxType,
  TaxRate, 
  TaxRule, 
  TaxCalculationResult 
} from '@/types/tax';

interface TaxCalculationParams {
  amount: number;
  countryCode: string;
  stateCode?: string;
  customerType: CustomerType;
  vatNumber?: string;
  productType?: string;
}

export class TaxService {
  private static taxRates: Map<string, TaxRate> = new Map();
  private static readonly TAX_RATE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static lastCacheUpdate: number = 0;

  /**
   * Calculate applicable taxes for a given transaction
   */
  public async calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
    const { amount, countryCode, stateCode, customerType, vatNumber, productType } = params;

    // Check for tax exemption first
    if (vatNumber) {
      const isExempt = await this.checkVatExemption(vatNumber, countryCode);
      if (isExempt) {
        return {
          subtotal: amount,
          taxAmount: 0,
          total: amount,
          breakdown: [],
          appliedRules: []
        };
      }
    }

    // Get applicable tax rates and rules
    const [taxRates, taxRules] = await Promise.all([
      this.getApplicableTaxRates({ countryCode, stateCode, customerType, productType }),
      this.getApplicableTaxRules({ countryCode, stateCode, customerType })
    ]);

    // Calculate each tax component
    let totalTaxAmount = 0;
    let effectiveTaxRate = 0;
    const breakdown: TaxCalculationResult['breakdown'] = [];
    
    for (const rate of taxRates) {
      const applicableRules = taxRules.filter(rule => 
        rule.taxRateId === rate.id && 
        this.isRuleApplicable(rule, amount)
      );

      let rateToApply = rate.percentage;
      for (const rule of applicableRules) {
        rateToApply = this.applyTaxRule(rateToApply, rule);
      }

      const taxAmount = Math.round(amount * (rateToApply / 100));
      totalTaxAmount += taxAmount;
      effectiveTaxRate += rateToApply;

      breakdown.push({
        type: rate.type,
        rate: rateToApply,
        amount: taxAmount,
        description: this.generateTaxDescription(rate, rateToApply)
      });
    }

    return {
      subtotal: amount,
      taxAmount: totalTaxAmount,
      total: amount + totalTaxAmount,
      breakdown,
      appliedRules: taxRules
    };
  }

  private applyTaxRule(baseRate: number, rule: TaxRule): number {
    switch (rule.type) {
      case 'MODIFIER':
        return baseRate * (1 + rule.modifier);
      case 'OVERRIDE':
        return rule.override;
      default:
        return baseRate;
    }
  }

  private generateTaxDescription(rate: TaxRate, appliedRate: number): string {
    return `${rate.name} (${appliedRate.toFixed(2)}%)`;
  }

  private isRuleApplicable(rule: TaxRule, amount: number): boolean {
    if (!rule.conditions) return true;
    
    for (const condition of rule.conditions) {
      switch (condition.type) {
        case 'AMOUNT_THRESHOLD':
          if (amount < condition.threshold) return false;
          break;
        case 'DATE_RANGE':
          const now = new Date();
          if (condition.startDate && new Date(condition.startDate) > now) return false;
          if (condition.endDate && new Date(condition.endDate) < now) return false;
          break;
      }
    }
    
    return true;
  }

  /**
   * Get tax rates applicable to the transaction
   */
  private async getApplicableTaxRates(params: {
    countryCode: string;
    stateCode?: string;
    customerType: CustomerType;
    productType?: string;
  }): Promise<TaxRate[]> {
    const { countryCode, stateCode, customerType, productType } = params;

    return prisma.taxRate.findMany({
      where: {
        OR: [
          // Country-specific rates
          {
            countryCode,
            stateCode: stateCode || null,
            customerTypes: {
              has: customerType
            },
            active: true
          },
          // Default rates for the country
          {
            countryCode,
            stateCode: null,
            customerTypes: {
              has: customerType
            },
            active: true
          }
        ],
        // Filter by product type if specified
        ...(productType ? {
          productTypes: {
            has: productType
          }
        } : {})
      },
      orderBy: {
        priority: 'desc'
      }
    });
  }

  /**
   * Get tax rules applicable to the transaction
   */
  private async getApplicableTaxRules(params: {
    countryCode: string;
    stateCode?: string;
    customerType: CustomerType;
  }): Promise<TaxRule[]> {
    const { countryCode, stateCode, customerType } = params;

    return prisma.taxRule.findMany({
      where: {
        OR: [
          {
            countryCode,
            stateCode: stateCode || null,
            customerTypes: {
              has: customerType
            },
            active: true
          },
          {
            countryCode,
            stateCode: null,
            customerTypes: {
              has: customerType
            },
            active: true
          }
        ]
      },
      orderBy: {
        priority: 'desc'
      }
    });
  }

  /**
   * Validate VAT number and check exemption status
   */
  private async checkVatExemption(
    vatNumber?: string,
    countryCode?: string
  ): Promise<boolean> {
    if (!vatNumber || !countryCode) {
      return false;
    }

    // First check our cache
    const cachedValidation = await prisma.vatValidation.findFirst({
      where: {
        vatNumber,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (cachedValidation) {
      return cachedValidation.isValid;
    }

    // Validate with external service (implementation would depend on region)
    const isValid = await this.validateVatNumber(vatNumber, countryCode);

    // Cache the result
    await prisma.vatValidation.create({
      data: {
        vatNumber,
        countryCode,
        isValid,
        validatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days cache
      }
    });

    return isValid;
  }

  /**
   * Validate VAT number with external service
   */
  private async validateVatNumber(
    vatNumber: string,
    countryCode: string
  ): Promise<boolean> {
    // This would be implemented based on the region and validation service used
    // For example, using VIES for EU VAT numbers
    // This is a placeholder implementation
    return true;
  }
}
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
