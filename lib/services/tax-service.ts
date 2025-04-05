import { prisma } from '@/lib/prisma';
import { TaxRate, TaxRule, CustomerType } from '@prisma/client';

interface TaxCalculationParams {
  amount: number;
  countryCode: string;
  stateCode?: string;
  customerType: CustomerType;
  vatNumber?: string;
  productType?: string;
}

interface TaxResult {
  taxAmount: number;
  taxRate: number;
  breakdown: TaxBreakdown[];
  appliedRules: TaxRule[];
}

interface TaxBreakdown {
  type: string;
  rate: number;
  amount: number;
  description: string;
}

export class TaxService {
  /**
   * Calculate applicable taxes for a given transaction
   */
  public async calculateTax(params: TaxCalculationParams): Promise<TaxResult> {
    const {
      amount,
      countryCode,
      stateCode,
      customerType,
      vatNumber,
      productType
    } = params;

    // Get applicable tax rates
    const taxRates = await this.getApplicableTaxRates({
      countryCode,
      stateCode,
      customerType,
      productType
    });

    // Get applicable tax rules
    const taxRules = await this.getApplicableTaxRules({
      countryCode,
      stateCode,
      customerType
    });

    // Check VAT exemption
    const isVatExempt = await this.checkVatExemption(vatNumber, countryCode);

    // Calculate each tax component
    const breakdown: TaxBreakdown[] = [];
    let totalTaxAmount = 0;
    let effectiveTaxRate = 0;

    for (const rate of taxRates) {
      // Skip VAT if exempt
      if (rate.type === 'VAT' && isVatExempt) {
        continue;
      }

      // Apply tax rules
      const applicableRules = taxRules.filter(rule => 
        rule.taxRateId === rate.id &&
        this.isRuleApplicable(rule, amount)
      );

      // Calculate base rate
      let rateToApply = rate.percentage;

      // Modify rate based on rules
      for (const rule of applicableRules) {
        if (rule.type === 'MODIFIER') {
          rateToApply *= (1 + rule.modifier);
        } else if (rule.type === 'OVERRIDE') {
          rateToApply = rule.override;
        }
      }

      const taxAmount = Math.round(amount * (rateToApply / 100));
      totalTaxAmount += taxAmount;
      effectiveTaxRate += rateToApply;

      breakdown.push({
        type: rate.type,
        rate: rateToApply,
        amount: taxAmount,
        description: rate.description
      });
    }

    return {
      taxAmount: totalTaxAmount,
      taxRate: effectiveTaxRate,
      breakdown,
      appliedRules: taxRules
    };
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

  /**
   * Check if a tax rule applies based on amount thresholds
   */
  private isRuleApplicable(rule: TaxRule, amount: number): boolean {
    if (rule.minAmount && amount < rule.minAmount) {
      return false;
    }
    if (rule.maxAmount && amount > rule.maxAmount) {
      return false;
    }
    return true;
  }
}