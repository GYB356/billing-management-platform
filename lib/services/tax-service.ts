/**
 * Enhanced tax calculation service with international support
 */

import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { TaxRate } from '@prisma/client';

export interface TaxCalculationResult {
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  taxBreakdown?: Array<{
    type: string;
    rate: number;
    amount: number;
    jurisdiction: string;
    name?: string;
  }>;
}

export interface TaxExemption {
  type: 'NONE' | 'PARTIAL' | 'FULL';
  reason?: string;
  certificateNumber?: string;
  expiryDate?: Date;
  categories?: string[]; // e.g., ['EDUCATION', 'NONPROFIT']
}

interface OrganizationTaxSettings {
  taxExempt: boolean;
  taxCountry?: string;
  taxState?: string;
  taxId?: string;
  vatNumber?: string;
  exemption?: TaxExemption;
}

export class TaxService {
  // EU VAT rates (as of 2023)
  private static euVatRates: Record<string, number> = {
    'AT': 20, // Austria
    'BE': 21, // Belgium
    'BG': 20, // Bulgaria
    'HR': 25, // Croatia
    'CY': 19, // Cyprus
    'CZ': 21, // Czech Republic
    'DK': 25, // Denmark
    'EE': 20, // Estonia
    'FI': 24, // Finland
    'FR': 20, // France
    'DE': 19, // Germany
    'GR': 24, // Greece
    'HU': 27, // Hungary
    'IE': 23, // Ireland
    'IT': 22, // Italy
    'LV': 21, // Latvia
    'LT': 21, // Lithuania
    'LU': 17, // Luxembourg
    'MT': 18, // Malta
    'NL': 21, // Netherlands
    'PL': 23, // Poland
    'PT': 23, // Portugal
    'RO': 19, // Romania
    'SK': 20, // Slovakia
    'SI': 22, // Slovenia
    'ES': 21, // Spain
    'SE': 25, // Sweden
  };

  // US state tax rates (simplified, actual implementation would be more complex with local taxes)
  private static usStateTaxRates: Record<string, number> = {
    'AL': 4.0, // Alabama
    'AK': 0.0, // Alaska
    'AZ': 5.6, // Arizona
    'AR': 6.5, // Arkansas
    'CA': 7.25, // California
    'CO': 2.9, // Colorado
    'CT': 6.35, // Connecticut
    'DE': 0.0, // Delaware
    'FL': 6.0, // Florida
    'GA': 4.0, // Georgia
    'HI': 4.0, // Hawaii
    'ID': 6.0, // Idaho
    'IL': 6.25, // Illinois
    'IN': 7.0, // Indiana
    'IA': 6.0, // Iowa
    'KS': 6.5, // Kansas
    'KY': 6.0, // Kentucky
    'LA': 4.45, // Louisiana
    'ME': 5.5, // Maine
    'MD': 6.0, // Maryland
    'MA': 6.25, // Massachusetts
    'MI': 6.0, // Michigan
    'MN': 6.875, // Minnesota
    'MS': 7.0, // Mississippi
    'MO': 4.225, // Missouri
    'MT': 0.0, // Montana
    'NE': 5.5, // Nebraska
    'NV': 6.85, // Nevada
    'NH': 0.0, // New Hampshire
    'NJ': 6.625, // New Jersey
    'NM': 5.125, // New Mexico
    'NY': 4.0, // New York
    'NC': 4.75, // North Carolina
    'ND': 5.0, // North Dakota
    'OH': 5.75, // Ohio
    'OK': 4.5, // Oklahoma
    'OR': 0.0, // Oregon
    'PA': 6.0, // Pennsylvania
    'RI': 7.0, // Rhode Island
    'SC': 6.0, // South Carolina
    'SD': 4.5, // South Dakota
    'TN': 7.0, // Tennessee
    'TX': 6.25, // Texas
    'UT': 6.1, // Utah
    'VT': 6.0, // Vermont
    'VA': 5.3, // Virginia
    'WA': 6.5, // Washington
    'WV': 6.0, // West Virginia
    'WI': 5.0, // Wisconsin
    'WY': 4.0, // Wyoming
    'DC': 6.0, // District of Columbia
  };

  // Canadian GST/HST/PST rates
  private static canadianTaxRates: Record<string, { gst: number; pst?: number; hst?: number }> = {
    'AB': { gst: 5 }, // Alberta
    'BC': { gst: 5, pst: 7 }, // British Columbia
    'MB': { gst: 5, pst: 7 }, // Manitoba
    'NB': { gst: 0, hst: 15 }, // New Brunswick
    'NL': { gst: 0, hst: 15 }, // Newfoundland and Labrador
    'NT': { gst: 5 }, // Northwest Territories
    'NS': { gst: 0, hst: 15 }, // Nova Scotia
    'NU': { gst: 5 }, // Nunavut
    'ON': { gst: 0, hst: 13 }, // Ontario
    'PE': { gst: 0, hst: 15 }, // Prince Edward Island
    'QC': { gst: 5, pst: 9.975 }, // Quebec
    'SK': { gst: 5, pst: 6 }, // Saskatchewan
    'YT': { gst: 5 }, // Yukon
  };

  // Global standard tax rates for common countries
  private static globalTaxRates: Record<string, { rate: number; name: string; type: string }> = {
    'AU': { rate: 10, name: 'GST', type: 'VAT' }, // Australia GST
    'BR': { rate: 17, name: 'ICMS', type: 'VAT' }, // Brazil ICMS (varies by state)
    'CH': { rate: 7.7, name: 'VAT', type: 'VAT' }, // Switzerland VAT
    'CN': { rate: 13, name: 'VAT', type: 'VAT' }, // China VAT
    'IN': { rate: 18, name: 'GST', type: 'VAT' }, // India GST
    'JP': { rate: 10, name: 'Consumption Tax', type: 'VAT' }, // Japan Consumption Tax
    'KR': { rate: 10, name: 'VAT', type: 'VAT' }, // South Korea VAT
    'MX': { rate: 16, name: 'VAT', type: 'VAT' }, // Mexico VAT
    'NZ': { rate: 15, name: 'GST', type: 'VAT' }, // New Zealand GST
    'RU': { rate: 20, name: 'VAT', type: 'VAT' }, // Russia VAT
    'SG': { rate: 9, name: 'GST', type: 'VAT' }, // Singapore GST
    'ZA': { rate: 15, name: 'VAT', type: 'VAT' }, // South Africa VAT
  };

  // Digital services tax rates for digital products
  private static digitalServicesTaxRates: Record<string, number> = {
    'FR': 3, // France Digital Services Tax
    'IT': 3, // Italy Digital Services Tax
    'UK': 2, // UK Digital Services Tax
    'ES': 3, // Spain Digital Services Tax
  };

  /**
   * Get applicable tax rate for a country and state
   */
  static async getTaxRate(
    country: string,
    state?: string | null,
    isDigitalProduct: boolean = false
  ): Promise<TaxRate | null> {
    // Try to find an exact match with country and state in database
    if (state) {
      const exactMatch = await prisma.taxRate.findFirst({
        where: {
          country,
          state,
          active: true,
        },
      });

      if (exactMatch) {
        return exactMatch;
      }
    }

    // Fall back to country-level tax rate in database
    const countryRate = await prisma.taxRate.findFirst({
      where: {
        country,
        state: null,
        active: true,
      },
    });

    if (countryRate) {
      return countryRate;
    }

    // If no database entry, use our hardcoded rates
    let rate = 0;
    let type = 'SALES_TAX';
    let name = 'Tax';

    // EU VAT rates
    if (country in this.euVatRates) {
      rate = this.euVatRates[country];
      type = 'VAT';
      name = 'VAT';
    }
    // US state tax rates
    else if (country === 'US' && state && state in this.usStateTaxRates) {
      rate = this.usStateTaxRates[state];
      type = 'SALES_TAX';
      name = 'Sales Tax';
    }
    // Canadian tax rates
    else if (country === 'CA' && state) {
      const provinceTaxes = this.canadianTaxRates[state];
      if (provinceTaxes) {
        if (provinceTaxes.hst) {
          rate = provinceTaxes.hst;
          type = 'HST';
          name = 'HST';
        } else {
          rate = provinceTaxes.gst + (provinceTaxes.pst || 0);
          type = 'GST_PST';
          name = provinceTaxes.pst ? 'GST+PST' : 'GST';
        }
      }
    }
    // Global tax rates
    else if (country in this.globalTaxRates) {
      const taxInfo = this.globalTaxRates[country];
      rate = taxInfo.rate;
      type = taxInfo.type;
      name = taxInfo.name;
    }

    // Add digital services tax if applicable
    if (isDigitalProduct && country in this.digitalServicesTaxRates) {
      rate += this.digitalServicesTaxRates[country];
      name += ' + DST';
    }

    // Create a synthetic tax rate object if we found a rate
    if (rate > 0) {
      return {
        id: `synthetic-${country}${state ? `-${state}` : ''}`,
        country,
        state,
        percentage: rate,
        type,
        name,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Get organization tax settings
   */
  static async getOrganizationTaxSettings(organizationId: string): Promise<OrganizationTaxSettings> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error(`Organization with ID ${organizationId} not found`);
    }

    const settings = organization.settings as Record<string, any> || {};
    
    return {
      taxExempt: settings.taxExempt === true,
      taxCountry: settings.taxCountry || organization.address?.split(',').pop()?.trim() || 'US',
      taxState: settings.taxState,
      taxId: settings.taxId || organization.taxId,
      vatNumber: settings.vatNumber,
      exemption: settings.exemption as TaxExemption,
    };
  }

  /**
   * Calculate tax with support for multiple tax rates and exemptions
   */
  static async calculateTax({
    amount,
    currency,
    country,
    state,
    organizationId,
    isDigitalProduct = false,
    productTaxCategory = null,
  }: {
    amount: number;
    currency: string;
    country: string;
    state?: string;
    organizationId: string;
    isDigitalProduct?: boolean;
    productTaxCategory?: string | null;
  }): Promise<TaxCalculationResult> {
    // Get organization tax settings
    const taxSettings = await this.getOrganizationTaxSettings(organizationId);
    
    // If organization is tax exempt, return zero tax
    if (taxSettings.taxExempt) {
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
        taxBreakdown: [{
          type: 'EXEMPT',
          rate: 0,
          amount: 0,
          jurisdiction: country,
          name: 'Tax Exempt'
        }]
      };
    }

    // If EU and customer has VAT number, B2B transactions are usually exempt
    const isEUCountry = country in this.euVatRates;
    if (isEUCountry && taxSettings.vatNumber) {
      // In a real implementation, you would validate the VAT number
      // using VIES (VAT Information Exchange System)
      const isValidVatNumber = true; // Placeholder for VAT validation

      if (isValidVatNumber) {
        return {
          taxRate: 0,
          taxAmount: 0,
          totalAmount: amount,
          currency,
          taxBreakdown: [{
            type: 'VAT_REVERSE_CHARGE',
            rate: 0,
            amount: 0,
            jurisdiction: country,
            name: 'Reverse Charge VAT'
          }]
        };
      }
    }

    // Get applicable tax rate
    const taxRate = await this.getTaxRate(country, state, isDigitalProduct);
    
    if (!taxRate) {
      // Log missing tax rate
      await createEvent({
        eventType: 'MISSING_TAX_RATE',
        resourceType: 'TAX_RATE',
        severity: EventSeverity.WARNING,
        metadata: {
          country,
          state,
          organizationId,
          taxId: taxSettings.taxId
        }
      });
      
      return {
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        currency,
        taxBreakdown: [{
          type: 'UNKNOWN',
          rate: 0,
          amount: 0,
          jurisdiction: country,
          name: 'Unknown Tax Rate'
        }]
      };
    }

    // Calculate tax amount with proper rounding
    const taxAmount = Math.round(amount * (taxRate.percentage / 100));
    const totalAmount = amount + taxAmount;

    // Apply tax based on the specific region rules
    let taxBreakdown = [];

    // For Canadian taxes, show GST and PST/HST separately
    if (country === 'CA' && state && state in this.canadianTaxRates) {
      const provinceTaxes = this.canadianTaxRates[state];
      
      if (provinceTaxes.hst) {
        // HST provinces (single tax)
        taxBreakdown.push({
          type: 'HST',
          rate: provinceTaxes.hst,
          amount: taxAmount,
          jurisdiction: `CA-${state}`,
          name: `HST (${state})`
        });
      } else {
        // GST+PST provinces (split tax)
        const gstAmount = Math.round(amount * (provinceTaxes.gst / 100));
        const pstAmount = taxAmount - gstAmount;
        
        taxBreakdown.push({
          type: 'GST',
          rate: provinceTaxes.gst,
          amount: gstAmount,
          jurisdiction: 'CA',
          name: 'GST'
        });
        
        if (provinceTaxes.pst) {
          taxBreakdown.push({
            type: 'PST',
            rate: provinceTaxes.pst,
            amount: pstAmount,
            jurisdiction: `CA-${state}`,
            name: `PST (${state})`
          });
        }
      }
    } else {
      // Standard single tax rate
      taxBreakdown.push({
        type: taxRate.type,
        rate: taxRate.percentage,
        amount: taxAmount,
        jurisdiction: state ? `${country}-${state}` : country,
        name: taxRate.name
      });
    }

    return {
      taxRate: taxRate.percentage,
      taxAmount,
      totalAmount,
      currency,
      taxBreakdown
    };
  }

  /**
   * Validate EU VAT number
   * In a production environment, this would call the VIES API
   */
  static async validateEUVatNumber(vatNumber: string, countryCode: string): Promise<boolean> {
    if (!vatNumber || !countryCode) {
      return false;
    }

    // Mock validation for development
    // In production, you would use VIES API or a service like Avalara
    const isEUCountry = countryCode in this.euVatRates;
    if (!isEUCountry) {
      return false;
    }

    // Return true for testing - in production this would be a real validation
    return true;
  }

  /**
   * Check if a product category is tax exempt in the given jurisdiction
   */
  static isCategoryTaxExempt(category: string, country: string, state?: string): boolean {
    // Example exempt categories by jurisdiction
    // This would be much more comprehensive in a real implementation
    const exemptCategories: Record<string, string[]> = {
      'US': ['FOOD', 'MEDICINE', 'EDUCATION'],
      'US-CA': ['FOOD', 'MEDICINE', 'EDUCATION', 'BOOKS'],
      'UK': ['FOOD', 'MEDICINE', 'BOOKS', 'CHILDREN_CLOTHING'],
      'CA': ['FOOD', 'MEDICINE'],
    };

    const key = state ? `${country}-${state}` : country;
    return exemptCategories[key]?.includes(category) || false;
  }

  /**
   * Generate a tax document summary
   */
  static generateTaxDocumentSummary(
    organizationId: string,
    invoiceId: string,
    taxCalculation: TaxCalculationResult
  ): string {
    // In a real system, this would create a formal tax document
    const summary = `
Tax Summary for Invoice: ${invoiceId}
Organization: ${organizationId}
Total Amount: ${taxCalculation.currency} ${taxCalculation.totalAmount / 100}
Tax Amount: ${taxCalculation.currency} ${taxCalculation.taxAmount / 100}
Tax Rate: ${taxCalculation.taxRate}%

Tax Breakdown:
${taxCalculation.taxBreakdown?.map(tax => 
  `- ${tax.name}: ${taxCalculation.currency} ${tax.amount / 100} (${tax.rate}%)`
).join('\n') || 'None'}
`;

    return summary;
  }

  /**
   * Calculate taxes for invoice
   */
  static calculateTaxes(
    subtotal: number,
    taxRates: TaxRate[]
  ): Array<{ id: string; amount: number }> {
    return taxRates.map(taxRate => {
      const taxAmount = Math.round(subtotal * (taxRate.percentage / 100));
      return {
        id: taxRate.id,
        amount: taxAmount
      };
    });
  }
} 