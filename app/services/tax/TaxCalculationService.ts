import { prisma } from '@/lib/prisma';
import { TaxCalculation, Customer } from '@prisma/client';

interface TaxRate {
  country: string;
  state?: string;
  rate: number;
  type: 'standard' | 'reduced' | 'zero';
  description: string;
}

export class TaxCalculationService {
  private taxRates: Record<string, TaxRate[]> = {
    'US': [
      { country: 'US', state: 'CA', rate: 0.0825, type: 'standard', description: 'California Sales Tax' },
      { country: 'US', state: 'NY', rate: 0.08875, type: 'standard', description: 'New York Sales Tax' },
      // Add more US states
    ],
    'EU': [
      { country: 'DE', rate: 0.19, type: 'standard', description: 'German VAT' },
      { country: 'FR', rate: 0.20, type: 'standard', description: 'French VAT' },
      // Add more EU countries
    ],
    // Add more regions
  };

  async calculateTax(
    amount: number,
    currency: string,
    customer: Customer,
    isReverseCharge: boolean = false
  ): Promise<TaxCalculation> {
    return await prisma.$transaction(async (tx) => {
      try {
        // Get applicable tax rate
        const taxRate = this.getTaxRate(customer.country, customer.state);

        // Calculate tax amount
        const taxAmount = isReverseCharge ? 0 : amount * taxRate.rate;

        // Create tax calculation record
        const taxCalculation = await tx.taxCalculation.create({
          data: {
            amount,
            taxRate: taxRate.rate,
            taxAmount,
            country: customer.country,
            state: customer.state,
            customerId: customer.id,
            metadata: {
              isReverseCharge,
              taxRate: taxRate,
              currency
            }
          }
        });

        return taxCalculation;
      } catch (error) {
        console.error('Tax calculation failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId: customer.id,
          amount,
          currency
        });
        throw error;
      }
    });
  }

  private getTaxRate(country: string, state?: string): TaxRate {
    const countryRates = this.taxRates[country];
    if (!countryRates) {
      throw new Error(`No tax rates found for country: ${country}`);
    }

    if (state) {
      const stateRate = countryRates.find(rate => rate.state === state);
      if (stateRate) {
        return stateRate;
      }
    }

    const defaultRate = countryRates.find(rate => !rate.state);
    if (defaultRate) {
      return defaultRate;
    }

    throw new Error(`No applicable tax rate found for country: ${country}, state: ${state}`);
  }

  async validateTaxExemption(
    customerId: string,
    exemptionType: string,
    exemptionNumber: string
  ): Promise<boolean> {
    // Implement tax exemption validation
    // This is a placeholder - implement actual validation logic
    return true;
  }

  async getTaxHistory(customerId: string): Promise<TaxCalculation[]> {
    return await prisma.taxCalculation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }
    });
  }
}