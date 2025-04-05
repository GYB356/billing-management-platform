import { prisma } from "./prisma";
import { stripe } from "./stripe";
import { createEvent, EventSeverity } from "./events";
import { Organization } from "@prisma/client";

export type TaxType = 'VAT' | 'GST' | 'HST' | 'PST' | 'SALES_TAX';

export interface TaxRate {
  id: string;
  country: string;
  state?: string | null;
  rate: number;
  type: TaxType;
  name: string;
  description?: string;
  isActive: boolean;
  stripeId?: string;
}

export interface TaxExemption {
  id: string;
  organizationId: string;
  taxType: TaxType | 'ALL';
  exemptionCertificate?: string;
  validUntil?: Date;
  isActive: boolean;
}

export interface TaxCalculationResult {
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  taxBreakdown?: {
    type: TaxType;
    rate: number;
    amount: number;
    jurisdiction: string;
  }[];
}

export interface TaxConfiguration {
  id: string;
  organizationId?: string;
  country: string;
  state?: string | null;
  taxId?: string;
  taxExempt: boolean;
  validatedTaxId?: boolean;
}

export class TaxService {
  private static taxRates: Map<string, TaxRate> = new Map();
  private static readonly TAX_RATE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static lastCacheUpdate: number = 0;

  /**
   * Get a tax rate for a specific country and state
   */
  static async getTaxRate(country: string, state?: string | null): Promise<TaxRate | null> {
    const key = this.getTaxRateKey(country, state);
    
    // Check if tax rates need to be refreshed
    if (Date.now() - this.lastCacheUpdate > this.TAX_RATE_CACHE_DURATION) {
      await this.refreshTaxRateCache();
    }
    
    // Check if tax rate exists in cache
    if (this.taxRates.has(key)) {
      return this.taxRates.get(key) || null;
    }
    
    // Try to find tax rate in database
    const taxRate = await prisma.taxRate.findFirst({
      where: {
        country,
        state: state || null,
        isActive: true,
      },
    });
    
    if (taxRate) {
      const formattedTaxRate: TaxRate = {
        id: taxRate.id,
        country: taxRate.country,
        state: taxRate.state,
        rate: taxRate.rate,
        type: taxRate.type as TaxType,
        name: taxRate.name,
        description: taxRate.description || undefined,
        isActive: taxRate.isActive,
        stripeId: taxRate.stripeId || undefined,
      };
      
      // Cache the tax rate
      this.taxRates.set(key, formattedTaxRate);
      
      return formattedTaxRate;
    }
    
    // If no tax rate found, try to get a default country rate
    if (state) {
      return this.getTaxRate(country, null);
    }
    
    return null;
  }

  /**
   * Calculate tax for a given amount
   */
  static async calculateTax(
    amount: number,
    currency: string,
    country: string,
    state?: string,
    taxExempt: boolean = false,
    taxId?: string,
  ): Promise<TaxCalculationResult> {
    // If tax exempt, return no tax
    if (taxExempt) {
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
      };
    }
    
    // Get applicable tax rate
    const taxRate = await this.getTaxRate(country, state || null);
    
    if (!taxRate) {
      // Log missing tax rate
      await createEvent({
        eventType: 'MISSING_TAX_RATE',
        resourceType: 'TAX_RATE',
        severity: EventSeverity.WARNING,
        metadata: {
          country,
          state,
          taxId,
        },
      });
      
      // Return no tax if no rate found
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
      };
    }
    
    // Calculate tax with proper rounding
    const taxAmount = Math.round(amount * (taxRate.rate / 100));
    const totalAmount = amount + taxAmount;
    
    return {
      taxRate: taxRate.rate,
      taxAmount,
      totalAmount,
      currency,
      taxBreakdown: [
        {
          type: taxRate.type,
          rate: taxRate.rate,
          amount: taxAmount,
          jurisdiction: taxRate.state ? `${taxRate.country}-${taxRate.state}` : taxRate.country,
        },
      ],
    };
  }

  /**
   * Calculate tax for an organization
   */
  static async calculateTaxForOrganization(
    amount: number,
    currency: string,
    organization: Organization,
  ): Promise<TaxCalculationResult> {
    // Get organization tax settings
    const taxSettings = await this.getOrganizationTaxSettings(organization.id);
    
    // Check for tax exemption
    const isExempt = await this.isOrganizationTaxExempt(organization.id);
    
    // Calculate tax
    return this.calculateTax(
      amount,
      currency,
      organization.country || taxSettings?.country || 'US',
      organization.state || taxSettings?.state || undefined,
      isExempt,
      organization.taxId || taxSettings?.taxId,
    );
  }

  /**
   * Calculate VAT for European countries
   */
  static async calculateEUVAT(
    amount: number,
    currency: string,
    country: string,
    isBusinessCustomer: boolean = false,
    validatedVATID?: string,
  ): Promise<TaxCalculationResult> {
    // For B2B transactions with validated VAT ID, reverse charge applies (0% VAT)
    if (isBusinessCustomer && validatedVATID) {
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
        taxBreakdown: [
          {
            type: 'VAT',
            rate: 0,
            amount: 0,
            jurisdiction: country,
          },
        ],
      };
    }
    
    // For regular transactions or B2C, get the country VAT rate
    const taxRate = await this.getTaxRate(country);
    
    if (!taxRate) {
      // Log missing VAT rate
      await createEvent({
        eventType: 'MISSING_VAT_RATE',
        resourceType: 'TAX_RATE',
        severity: EventSeverity.WARNING,
        metadata: {
          country,
          isBusinessCustomer,
          validatedVATID,
        },
      });
      
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
      };
    }
    
    // Calculate VAT
    const taxAmount = Math.round(amount * (taxRate.rate / 100));
    const totalAmount = amount + taxAmount;
    
    return {
      taxRate: taxRate.rate,
      taxAmount,
      totalAmount,
      currency,
      taxBreakdown: [
        {
          type: 'VAT',
          rate: taxRate.rate,
          amount: taxAmount,
          jurisdiction: country,
        },
      ],
    };
  }

  /**
   * Validate a tax ID (VAT, GST, etc.)
   */
  static async validateTaxId(
    taxId: string,
    country: string,
    type: TaxType = 'VAT',
  ): Promise<{
    isValid: boolean;
    validatedTaxId?: string;
    name?: string;
    address?: string;
  }> {
    try {
      // For EU VAT, use the VIES service (or an external API)
      if (type === 'VAT' && this.isEUCountry(country)) {
        // This would be implemented with a real VAT validation service
        // For now, just simulate a response
        return {
          isValid: this.isValidFormatEUVAT(taxId, country),
          validatedTaxId: taxId,
          name: 'Example Company Name',
          address: 'Example Address',
        };
      }
      
      // For other tax IDs, check basic format validity
      // In a real implementation, we would use country-specific validation
      return {
        isValid: taxId.length > 5,
        validatedTaxId: taxId,
      };
    } catch (error) {
      console.error('Error validating tax ID:', error);
      
      await createEvent({
        eventType: 'TAX_ID_VALIDATION_ERROR',
        resourceType: 'TAX_ID',
        severity: EventSeverity.ERROR,
        metadata: {
          taxId,
          country,
          type,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      return { isValid: false };
    }
  }

  /**
   * Set organization tax exemption
   */
  static async setOrganizationTaxExemption(
    organizationId: string,
    isExempt: boolean,
    exemptionCertificate?: string,
    validUntil?: Date,
  ): Promise<TaxExemption> {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      throw new Error(`Organization with ID ${organizationId} not found`);
    }
    
    // Create or update tax exemption
    const exemption = await prisma.taxExemption.upsert({
      where: {
        organizationId_taxType: {
          organizationId,
          taxType: 'ALL',
        },
      },
      update: {
        isActive: isExempt,
        exemptionCertificate: exemptionCertificate,
        validUntil: validUntil,
      },
      create: {
        organizationId,
        taxType: 'ALL',
        isActive: isExempt,
        exemptionCertificate: exemptionCertificate,
        validUntil: validUntil,
      },
    });
    
    // Log event
    await createEvent({
      organizationId,
      eventType: isExempt ? 'TAX_EXEMPTION_ENABLED' : 'TAX_EXEMPTION_DISABLED',
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        exemptionId: exemption.id,
        exemptionCertificate: !!exemptionCertificate,
        validUntil: validUntil?.toISOString(),
      },
    });
    
    return {
      id: exemption.id,
      organizationId: exemption.organizationId,
      taxType: exemption.taxType as TaxType | 'ALL',
      exemptionCertificate: exemption.exemptionCertificate || undefined,
      validUntil: exemption.validUntil || undefined,
      isActive: exemption.isActive,
    };
  }

  /**
   * Check if organization is tax exempt
   */
  static async isOrganizationTaxExempt(
    organizationId: string,
    taxType?: TaxType,
  ): Promise<boolean> {
    const exemption = await prisma.taxExemption.findFirst({
      where: {
        organizationId,
        OR: [
          { taxType: taxType || undefined },
          { taxType: 'ALL' },
        ],
        isActive: true,
        validUntil: {
          gte: new Date(),
        },
      },
    });
    
    return !!exemption;
  }

  /**
   * Get or create organization tax settings
   */
  static async getOrganizationTaxSettings(
    organizationId: string,
  ): Promise<TaxConfiguration | null> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      return null;
    }
    
    // Get tax settings from organization metadata
    const taxSettings = organization.settings?.taxSettings as TaxConfiguration || null;
    
    if (taxSettings) {
      return {
        ...taxSettings,
        taxExempt: await this.isOrganizationTaxExempt(organizationId),
      };
    }
    
    // If no tax settings found, create default settings
    return {
      id: `tax-config-${organizationId}`,
      organizationId,
      country: organization.country || 'US',
      state: organization.state || null,
      taxId: organization.taxId || undefined,
      taxExempt: await this.isOrganizationTaxExempt(organizationId),
      validatedTaxId: false,
    };
  }

  /**
   * Refresh the tax rate cache from the database
   */
  private static async refreshTaxRateCache(): Promise<void> {
    try {
      const taxRates = await prisma.taxRate.findMany({
        where: {
          isActive: true,
        },
      });
      
      // Clear existing cache
      this.taxRates.clear();
      
      // Populate cache with fresh data
      for (const taxRate of taxRates) {
        const key = this.getTaxRateKey(taxRate.country, taxRate.state);
        
        this.taxRates.set(key, {
          id: taxRate.id,
          country: taxRate.country,
          state: taxRate.state,
          rate: taxRate.rate,
          type: taxRate.type as TaxType,
          name: taxRate.name,
          description: taxRate.description || undefined,
          isActive: taxRate.isActive,
          stripeId: taxRate.stripeId || undefined,
        });
      }
      
      // Update last cache refresh timestamp
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('Error refreshing tax rate cache:', error);
      
      await createEvent({
        eventType: 'TAX_RATE_CACHE_REFRESH_ERROR',
        resourceType: 'TAX_RATE',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Generate a unique key for tax rate cache
   */
  private static getTaxRateKey(country: string, state?: string | null): string {
    return `${country}${state ? `-${state}` : ''}`;
  }

  /**
   * Check if a country is in the EU
   */
  private static isEUCountry(country: string): boolean {
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    ];
    
    return euCountries.includes(country.toUpperCase());
  }

  /**
   * Basic check if a VAT number format is valid for EU countries
   */
  private static isValidFormatEUVAT(vat: string, country: string): boolean {
    // Remove any spaces or symbols
    const cleanVat = vat.replace(/[^a-zA-Z0-9]/g, '');
    
    // Check if VAT starts with country code
    if (!cleanVat.toUpperCase().startsWith(country.toUpperCase())) {
      return false;
    }
    
    // Basic length check (actual validation would be more complex)
    return cleanVat.length >= 8;
  }
} 