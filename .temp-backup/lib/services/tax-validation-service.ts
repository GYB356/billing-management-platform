import prisma from '@/lib/prisma';
import { TaxType } from '@/types/tax';
import { createEvent, EventType } from '@/lib/events';
import axios from 'axios';

interface ValidationResult {
  isValid: boolean;
  name?: string;
  address?: string;
  validatedAt: Date;
  validUntil: Date;
  metadata?: Record<string, any>;
}

export class TaxValidationService {
  private static readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static readonly VIES_API_URL = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';

  /**
   * Validate a tax ID/number
   */
  public async validateTaxId(
    taxId: string,
    countryCode: string,
    type: TaxType = TaxType.VAT
  ): Promise<ValidationResult> {
    // Check cache first
    const cachedValidation = await prisma.taxIdValidation.findFirst({
      where: {
        taxId,
        countryCode,
        type,
        validUntil: {
          gt: new Date()
        }
      },
      orderBy: {
        validatedAt: 'desc'
      }
    });

    if (cachedValidation) {
      return {
        isValid: cachedValidation.isValid,
        name: cachedValidation.businessName || undefined,
        address: cachedValidation.businessAddress || undefined,
        validatedAt: cachedValidation.validatedAt,
        validUntil: cachedValidation.validUntil,
        metadata: cachedValidation.metadata as Record<string, any>
      };
    }

    // Perform validation based on tax type and country
    let validationResult: ValidationResult;

    switch (type) {
      case TaxType.VAT:
        if (this.isEUCountry(countryCode)) {
          validationResult = await this.validateEUVAT(taxId, countryCode);
        } else {
          validationResult = await this.validateLocalVAT(taxId, countryCode);
        }
        break;
      
      case TaxType.GST:
        validationResult = await this.validateGST(taxId, countryCode);
        break;
      
      default:
        validationResult = await this.validateGenericTaxId(taxId, countryCode, type);
    }

    // Cache the result
    await prisma.taxIdValidation.create({
      data: {
        taxId,
        countryCode,
        type,
        isValid: validationResult.isValid,
        businessName: validationResult.name,
        businessAddress: validationResult.address,
        validatedAt: validationResult.validatedAt,
        validUntil: validationResult.validUntil,
        metadata: validationResult.metadata || {}
      }
    });

    // Log the validation
    await createEvent({
      eventType: EventType.TAX_ID_VALIDATION,
      resourceType: 'TAX_ID',
      resourceId: taxId,
      metadata: {
        countryCode,
        type,
        isValid: validationResult.isValid,
        validatedAt: validationResult.validatedAt
      }
    });

    return validationResult;
  }

  /**
   * Validate EU VAT number using VIES
   */
  private async validateEUVAT(
    vatNumber: string,
    countryCode: string
  ): Promise<ValidationResult> {
    try {
      const response = await axios.post(TaxValidationService.VIES_API_URL, {
        countryCode,
        vatNumber: vatNumber.replace(/^${countryCode}/i, '') // Remove country prefix if present
      });

      const now = new Date();
      return {
        isValid: response.data.valid,
        name: response.data.name,
        address: response.data.address,
        validatedAt: now,
        validUntil: new Date(now.getTime() + TaxValidationService.CACHE_DURATION),
        metadata: {
          requestDate: response.data.requestDate,
          consultationNumber: response.data.consultationNumber
        }
      };
    } catch (error) {
      console.error('Error validating EU VAT:', error);
      return this.getFailedValidation();
    }
  }

  /**
   * Validate GST number
   */
  private async validateGST(
    gstNumber: string,
    countryCode: string
  ): Promise<ValidationResult> {
    // Implementation would vary by country
    // This is a placeholder that would be replaced with actual GST validation
    return this.getFailedValidation();
  }

  /**
   * Validate local VAT number
   */
  private async validateLocalVAT(
    vatNumber: string,
    countryCode: string
  ): Promise<ValidationResult> {
    // Implementation would vary by country
    // This is a placeholder that would be replaced with actual local VAT validation
    return this.getFailedValidation();
  }

  /**
   * Validate generic tax ID
   */
  private async validateGenericTaxId(
    taxId: string,
    countryCode: string,
    type: TaxType
  ): Promise<ValidationResult> {
    // Implementation would vary by country and tax type
    // This is a placeholder that would be replaced with actual validation
    return this.getFailedValidation();
  }

  private getFailedValidation(): ValidationResult {
    const now = new Date();
    return {
      isValid: false,
      validatedAt: now,
      validUntil: new Date(now.getTime() + TaxValidationService.CACHE_DURATION)
    };
  }

  private isEUCountry(countryCode: string): boolean {
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    return euCountries.includes(countryCode.toUpperCase());
  }
}