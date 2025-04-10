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