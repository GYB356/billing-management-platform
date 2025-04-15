import { TaxRateModel, TaxRate } from '../models/taxRate.model';
import { ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { TransactionManager } from '../utils/TransactionManager';

interface TaxCalculationInput {
  amount: number;
  countryCode: string;
  stateCode?: string;
  isBusinessCustomer?: boolean;
  vatNumber?: string;
}

interface TaxCalculationResult {
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  taxName: string;
  totalAmount: number;
  countryCode: string;
  stateCode?: string;
  isBusinessCustomer: boolean;
  vatNumber?: string;
  reverseCharge?: boolean;
}

export class TaxService {
  private taxRateModel: TaxRateModel;
  private readonly vatNumberRegex = /^[A-Z]{2}[0-9A-Z]+$/;

  constructor() {
    this.taxRateModel = new TaxRateModel();
  }

  async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    try {
      this.validateInput(input);

      // Get tax rate based on location
      const taxRate = await this.getTaxRate(input.countryCode, input.stateCode);
      
      // Handle EU VAT special cases
      if (taxRate.isEU) {
        return this.handleEUVAT(input, taxRate);
      }

      // Calculate standard tax
      const taxAmount = this.roundTax(input.amount * taxRate.rate);

      return {
        taxableAmount: input.amount,
        taxAmount,
        taxRate: taxRate.rate,
        taxName: taxRate.name,
        totalAmount: input.amount + taxAmount,
        countryCode: input.countryCode,
        stateCode: input.stateCode,
        isBusinessCustomer: input.isBusinessCustomer || false
      };
    } catch (error) {
      Logger.error('Tax calculation error', { error, input });
      throw error;
    }
  }

  private async handleEUVAT(
    input: TaxCalculationInput,
    taxRate: TaxRate
  ): Promise<TaxCalculationResult> {
    // Check if B2B with valid VAT number
    if (input.isBusinessCustomer && input.vatNumber) {
      const isValidVAT = await this.validateEUVATNumber(input.vatNumber);
      
      if (isValidVAT) {
        // Apply reverse charge mechanism
        return {
          taxableAmount: input.amount,
          taxAmount: 0,
          taxRate: 0,
          taxName: 'Reverse Charge',
          totalAmount: input.amount,
          countryCode: input.countryCode,
          stateCode: input.stateCode,
          isBusinessCustomer: true,
          vatNumber: input.vatNumber,
          reverseCharge: true
        };
      }
    }

    // Apply standard VAT
    const taxAmount = this.roundTax(input.amount * taxRate.rate);

    return {
      taxableAmount: input.amount,
      taxAmount,
      taxRate: taxRate.rate,
      taxName: `${input.countryCode} VAT`,
      totalAmount: input.amount + taxAmount,
      countryCode: input.countryCode,
      stateCode: input.stateCode,
      isBusinessCustomer: input.isBusinessCustomer || false,
      vatNumber: input.vatNumber
    };
  }

  private async getTaxRate(countryCode: string, stateCode?: string): Promise<TaxRate> {
    let taxRate: TaxRate | null;

    if (stateCode) {
      // Try to find state-specific rate first
      taxRate = await this.taxRateModel.findByCountryAndState(countryCode, stateCode);
      if (taxRate) return taxRate;
    }

    // Fall back to country-level rate
    const countryRates = await this.taxRateModel.findByCountry(countryCode);
    taxRate = countryRates.find(rate => !rate.stateCode);

    if (!taxRate) {
      throw new ValidationError('Tax rate not found', {
        countryCode: 'No tax rate configured for this location'
      });
    }

    return taxRate;
  }

  private validateInput(input: TaxCalculationInput): void {
    const errors: Record<string, string> = {};

    if (!input.amount || input.amount <= 0) {
      errors.amount = 'Amount must be greater than zero';
    }

    if (!input.countryCode || !/^[A-Z]{2}$/.test(input.countryCode)) {
      errors.countryCode = 'Invalid country code';
    }

    if (input.stateCode && !/^[A-Z0-9]{2,3}$/.test(input.stateCode)) {
      errors.stateCode = 'Invalid state code';
    }

    if (input.vatNumber && !this.vatNumberRegex.test(input.vatNumber)) {
      errors.vatNumber = 'Invalid VAT number format';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Invalid tax calculation input', errors);
    }
  }

  private async validateEUVATNumber(vatNumber: string): Promise<boolean> {
    try {
      // TODO: Implement actual VAT validation using VIES API
      // For now, just validate format
      return this.vatNumberRegex.test(vatNumber);
    } catch (error) {
      Logger.error('VAT number validation error', { error, vatNumber });
      return false;
    }
  }

  private roundTax(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  async updateTaxRate(
    id: string,
    rate: number,
    name?: string
  ): Promise<TaxRate> {
    return TransactionManager.executeInTransaction(async (prisma) => {
      const taxRate = await prisma.taxRate.update({
        where: { id },
        data: {
          rate,
          ...(name && { name }),
          updatedAt: new Date()
        }
      });

      Logger.info('Tax rate updated', { id, rate, name });
      return taxRate;
    });
  }

  async deactivateTaxRate(id: string): Promise<TaxRate> {
    return TransactionManager.executeInTransaction(async (prisma) => {
      const taxRate = await prisma.taxRate.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      Logger.info('Tax rate deactivated', { id });
      return taxRate;
    });
  }
} 