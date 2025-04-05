/**
 * Enhanced currency service to support multi-currency operations
 */

import { prisma } from '../prisma';
import { Organization } from '@prisma/client';
import { createEvent, EventSeverity } from '../events';

export interface ExchangeRateResult {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface CurrencyFormatOptions {
  locale?: string;
  style?: 'currency' | 'decimal';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  symbolDisplay?: 'code' | 'symbol' | 'narrow';
  position?: 'before' | 'after';
}

export interface ConvertAmountOptions {
  rounding?: 'floor' | 'ceil' | 'round';
  applyFee?: boolean;
  feePercentage?: number;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

export interface TaxCalculation {
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  taxBreakdown?: {
    vat?: number;
    gst?: number;
    salesTax?: number;
    other?: number;
  };
}

export class CurrencyService {
  // Supported currencies with ISO 4217 codes
  private static supportedCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
    { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
    { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimals: 2 },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2 },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimals: 2 },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimals: 2 },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2 },
    { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', decimals: 2 },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', decimals: 2 },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2 },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimals: 2 },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimals: 2 },
    { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimals: 2 },
    { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', decimals: 2 },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', decimals: 2 },
    { code: 'AED', symbol: 'د.إ', name: 'United Arab Emirates Dirham', decimals: 2 },
  ];

  // Cache for exchange rates to minimize API calls
  private static exchangeRateCache: Map<string, ExchangeRate> = new Map();
  private static readonly EXCHANGE_RATE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get exchange rate between two currencies
   * 
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @returns Exchange rate information
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cachedRate = this.exchangeRateCache.get(cacheKey);

    if (cachedRate && Date.now() - cachedRate.timestamp.getTime() < this.EXCHANGE_RATE_CACHE_TTL) {
      return cachedRate.rate;
    }

    try {
      // In a real implementation, this would call an external exchange rate API
      // For now, we'll use a mock implementation
      const mockRates: Record<string, number> = {
        'USD-EUR': 0.85,
        'EUR-USD': 1.18,
        'USD-GBP': 0.73,
        'GBP-USD': 1.37,
        'EUR-GBP': 0.86,
        'GBP-EUR': 1.16,
      };

      const rate = mockRates[`${fromCurrency}-${toCurrency}`] || 1;
      
      this.exchangeRateCache.set(cacheKey, {
        from: fromCurrency,
        to: toCurrency,
        rate,
        timestamp: new Date(),
      });

      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      await createEvent({
        eventType: 'EXCHANGE_RATE_ERROR',
        severity: EventSeverity.ERROR,
        metadata: {
          fromCurrency,
          toCurrency,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Convert amount from one currency to another
   * 
   * @param amount Amount to convert
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @param options Conversion options
   * @returns Converted amount
   */
  static async convertAmount(
    amount: number, 
    fromCurrency: string, 
    toCurrency: string, 
    options: ConvertAmountOptions = {}
  ): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    
    // Apply conversion
    let convertedAmount = amount * rate;
    
    // Apply fees if specified
    if (options.applyFee && options.feePercentage) {
      convertedAmount *= (1 + options.feePercentage / 100);
    }
    
    // Apply rounding
    switch (options.rounding) {
      case 'floor':
        return Math.floor(convertedAmount);
      case 'ceil':
        return Math.ceil(convertedAmount);
      case 'round':
      default:
        return Math.round(convertedAmount);
    }
  }

  /**
   * Format an amount in the specified currency
   * 
   * @param amount Amount to format
   * @param currencyCode Currency code (e.g., USD)
   * @param options Formatting options
   * @returns Formatted currency string
   */
  static formatCurrency(
    amount: number, 
    currencyCode: string, 
    options: CurrencyFormatOptions = {}
  ): string {
    const currencyInfo = this.supportedCurrencies.find(c => c.code === currencyCode);
    
    if (!currencyInfo) {
      console.warn(`Unknown currency code: ${currencyCode}, falling back to USD`);
      return this.formatCurrency(amount, 'USD', options);
    }
    
    const locale = options.locale || 'en-US';
    
    // For decimal style, use standard number formatting
    if (options.style === 'decimal') {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: options.minimumFractionDigits ?? currencyInfo.decimals,
        maximumFractionDigits: options.maximumFractionDigits ?? currencyInfo.decimals,
      }).format(amount / Math.pow(10, currencyInfo.decimals));
    }
    
    // For customized symbol display and position
    if (options.symbolDisplay === 'code' || options.position === 'after') {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: options.minimumFractionDigits ?? currencyInfo.decimals,
        maximumFractionDigits: options.maximumFractionDigits ?? currencyInfo.decimals,
      }).format(amount / Math.pow(10, currencyInfo.decimals));
      
      if (options.position === 'after') {
        return `${formatted} ${currencyInfo.symbol}`;
      } else {
        return `${currencyCode} ${formatted}`;
      }
    }
    
    // Default case: use Intl.NumberFormat with currency style
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: options.minimumFractionDigits ?? currencyInfo.decimals,
      maximumFractionDigits: options.maximumFractionDigits ?? currencyInfo.decimals,
      currencyDisplay: options.symbolDisplay === 'narrow' ? 'narrowSymbol' : 'symbol',
    }).format(amount / Math.pow(10, currencyInfo.decimals));
  }

  /**
   * Get all supported currencies
   * 
   * @returns Array of supported currencies
   */
  static getSupportedCurrencies() {
    return [...this.supportedCurrencies];
  }

  /**
   * Get user's preferred currency
   * 
   * @param userId User ID
   * @returns Preferred currency code or 'USD' as default
   */
  static async getUserPreferredCurrency(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preference: true }
    });
    
    if (user?.preference?.currency) {
      return user.preference.currency;
    }
    
    return 'USD';
  }

  /**
   * Get organization's preferred currency
   * 
   * @param organizationId Organization ID
   * @returns Preferred currency code or 'USD' as default
   */
  static async getOrganizationPreferredCurrency(organizationId: string): Promise<string> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true }
    });
    
    // Check if organization settings have preferred currency
    if (organization?.settings && 
        typeof organization.settings === 'object' && 
        'preferredCurrency' in organization.settings) {
      return organization.settings.preferredCurrency as string;
    }
    
    return 'USD';
  }

  /**
   * Get currency information by code
   * 
   * @param currencyCode Currency code
   * @returns Currency information or undefined if not supported
   */
  static getCurrencyInfo(currencyCode: string) {
    return this.supportedCurrencies.find(c => c.code === currencyCode);
  }

  /**
   * Calculate tax based on amount, currency, and location
   */
  static async calculateTax(
    amount: number,
    currency: string,
    organization: {
      country?: string;
      state?: string;
      taxExempt?: boolean;
      taxId?: string;
    }
  ): Promise<TaxCalculation> {
    try {
      // In a real implementation, this would integrate with a tax calculation service
      // For now, we'll use a simplified mock implementation
      let taxRate = 0;

      if (!organization.taxExempt) {
        switch (organization.country) {
          case 'US':
            taxRate = organization.state === 'CA' ? 0.0825 : 0.06;
            break;
          case 'GB':
            taxRate = 0.20; // VAT
            break;
          case 'DE':
            taxRate = 0.19; // VAT
            break;
          default:
            taxRate = 0.20; // Default VAT rate
        }
      }

      const taxAmount = Math.round(amount * taxRate * 100) / 100;
      const totalAmount = amount + taxAmount;

      return {
        taxRate,
        taxAmount,
        totalAmount,
        taxBreakdown: {
          vat: taxRate > 0 ? taxAmount : 0,
        },
      };
    } catch (error) {
      console.error('Error calculating tax:', error);
      await createEvent({
        eventType: 'TAX_CALCULATION_ERROR',
        severity: EventSeverity.ERROR,
        metadata: {
          amount,
          currency,
          organization: {
            country: organization.country,
            state: organization.state,
            taxExempt: organization.taxExempt,
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }
} 