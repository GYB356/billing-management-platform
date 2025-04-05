/**
 * Enhanced currency service to support multi-currency operations
 */

import { prisma } from './prisma';
import { stripe } from './stripe';
import { createEvent, EventSeverity } from './events';
import { Organization } from '@prisma/client';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export interface CurrencyConversionResult {
  amount: number;
  originalAmount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: number;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: Date;
}

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

  private static exchangeRates: Map<string, ExchangeRate> = new Map();
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static lastCacheRefresh = 0;

  // Cache for exchange rates to minimize API calls
  private static exchangeRateCache: Map<string, { rate: number; timestamp: Date }> = new Map();
  private static cacheTTLMs = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): Currency[] {
    return this.supportedCurrencies.filter(c => c.isActive);
  }

  /**
   * Check if a currency is supported
   */
  static isSupportedCurrency(currencyCode: string): boolean {
    return this.supportedCurrencies.some(c => c.code === currencyCode.toUpperCase() && c.isActive);
  }

  /**
   * Get currency details by code
   */
  static getCurrencyByCode(currencyCode: string): Currency | undefined {
    return this.supportedCurrencies.find(c => c.code === currencyCode.toUpperCase());
  }

  /**
   * Format currency with proper symbol and decimals
   */
  static formatCurrency(amount: number, currencyCode: string): string {
    const currency = this.getCurrencyByCode(currencyCode.toUpperCase());
    
    if (!currency) {
      // Default formatting if currency not found
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
      }).format(amount / 100);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    }).format(amount / 100);
  }

  /**
   * Convert amount from one currency to another
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyConversionResult> {
    // If currencies are the same, no conversion needed
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return {
        amount,
        originalAmount: amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: 1,
        timestamp: Date.now(),
      };
    }

    try {
      // Get exchange rate
      const rate = await this.getExchangeRate(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase()
      );
      
      // Calculate converted amount with proper rounding
      const convertedAmount = this.roundAmountForCurrency(
        amount * rate,
        toCurrency.toUpperCase()
      );

      return {
        amount: convertedAmount,
        originalAmount: amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error converting currency:', error);
      
      // Log the error for monitoring
      await createEvent({
        eventType: 'CURRENCY_CONVERSION_ERROR',
        resourceType: 'CURRENCY',
        severity: EventSeverity.ERROR,
        metadata: {
          fromCurrency,
          toCurrency,
          amount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      // Return original amount and rate of 1 in case of error
      return {
        amount,
        originalAmount: amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: 1,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get exchange rate between two currencies
   * 
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @returns Exchange rate information
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResult> {
    // If same currency, rate is always 1
    if (fromCurrency === toCurrency) {
      return {
        from: fromCurrency,
        to: toCurrency,
        rate: 1,
        timestamp: new Date(),
        source: 'internal'
      };
    }

    // Check cache first
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cachedRate = this.exchangeRateCache.get(cacheKey);
    const now = new Date();
    
    if (cachedRate && (now.getTime() - cachedRate.timestamp.getTime() < this.cacheTTLMs)) {
      return {
        from: fromCurrency,
        to: toCurrency,
        rate: cachedRate.rate,
        timestamp: cachedRate.timestamp,
        source: 'cache'
      };
    }

    try {
      // Fetch from exchange rate API
      const response = await fetch(
        `https://api.exchangerate.host/latest?base=${fromCurrency}&symbols=${toCurrency}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.rates || !data.rates[toCurrency]) {
        throw new Error(`No rate found for ${fromCurrency} to ${toCurrency}`);
      }
      
      const rate = data.rates[toCurrency];
      
      // Update cache
      this.exchangeRateCache.set(cacheKey, { 
        rate, 
        timestamp: now 
      });
      
      // Log successful rate fetch
      await createEvent({
        eventType: 'EXCHANGE_RATE_FETCHED',
        resourceType: 'CURRENCY',
        severity: EventSeverity.INFO,
        metadata: {
          fromCurrency,
          toCurrency,
          rate,
          source: 'exchangerate.host'
        }
      });
      
      return {
        from: fromCurrency,
        to: toCurrency,
        rate,
        timestamp: now,
        source: 'exchangerate.host'
      };
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      
      // Log error
      await createEvent({
        eventType: 'EXCHANGE_RATE_ERROR',
        resourceType: 'CURRENCY',
        severity: EventSeverity.ERROR,
        metadata: {
          fromCurrency,
          toCurrency,
          error: (error as Error).message
        }
      });
      
      // If we have a stale cache entry, use it as fallback
      if (cachedRate) {
        return {
          from: fromCurrency,
          to: toCurrency,
          rate: cachedRate.rate,
          timestamp: cachedRate.timestamp,
          source: 'stale-cache'
        };
      }
      
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
    const { rate } = await this.getExchangeRate(fromCurrency, toCurrency);
    
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
   * Get exchange rate from Stripe API
   * @private
   */
  private static async getStripeExchangeRate(
    fromCurrency: string, 
    toCurrency: string
  ): Promise<number> {
    try {
      // Get exchange rate from Stripe
      const response = await stripe.exchangeRates.retrieve(toCurrency);
      
      if (!response.rates[fromCurrency]) {
        throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
      }
      
      // Stripe returns the inverse of what we need, so we take the reciprocal
      return 1 / response.rates[fromCurrency];
    } catch (error) {
      console.error('Error getting exchange rate from Stripe:', error);
      throw error;
    }
  }

  /**
   * Save exchange rate to database and cache
   * @private
   */
  private static async saveExchangeRate(
    fromCurrency: string, 
    toCurrency: string, 
    rate: number
  ): Promise<ExchangeRate> {
    // Save to database
    const savedRate = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency,
          toCurrency,
        },
      },
      update: {
        rate,
        lastUpdated: new Date(),
      },
      create: {
        fromCurrency,
        toCurrency,
        rate,
        lastUpdated: new Date(),
      },
    });
    
    // Add to cache
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const exchangeRate: ExchangeRate = {
      id: savedRate.id,
      fromCurrency: savedRate.fromCurrency,
      toCurrency: savedRate.toCurrency,
      rate: savedRate.rate,
      lastUpdated: savedRate.lastUpdated,
    };
    
    this.exchangeRates.set(cacheKey, exchangeRate);
    
    return exchangeRate;
  }

  /**
   * Refresh the exchange rate cache
   * @private
   */
  private static async refreshExchangeRateCache(): Promise<void> {
    try {
      // Get all exchange rates from database
      const dbRates = await prisma.exchangeRate.findMany({
        where: {
          lastUpdated: {
            gte: new Date(Date.now() - this.CACHE_DURATION),
          },
        },
      });
      
      // Clear and repopulate cache
      this.exchangeRates.clear();
      
      for (const rate of dbRates) {
        const cacheKey = `${rate.fromCurrency}-${rate.toCurrency}`;
        this.exchangeRates.set(cacheKey, {
          id: rate.id,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
          lastUpdated: rate.lastUpdated,
        });
      }
      
      this.lastCacheRefresh = Date.now();
    } catch (error) {
      console.error('Error refreshing exchange rate cache:', error);
      
      // Log the error
      await createEvent({
        eventType: 'EXCHANGE_RATE_CACHE_REFRESH_ERROR',
        resourceType: 'CURRENCY',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Update all exchange rates with fresh data
   */
  static async updateAllExchangeRates(): Promise<void> {
    try {
      // Get all supported active currencies
      const currencies = this.getSupportedCurrencies();
      
      // Fetch all possible combinations of exchange rates
      for (const fromCurrency of currencies) {
        for (const toCurrency of currencies) {
          // Skip same currency
          if (fromCurrency.code === toCurrency.code) continue;
          
          try {
            // Get rate from Stripe
            const rate = await this.getStripeExchangeRate(
              fromCurrency.code,
              toCurrency.code
            );
            
            // Save to database and cache
            await this.saveExchangeRate(
              fromCurrency.code,
              toCurrency.code,
              rate
            );
            
            // Avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error updating rate ${fromCurrency.code} to ${toCurrency.code}:`, error);
          }
        }
      }
      
      // Update last cache refresh time
      this.lastCacheRefresh = Date.now();
      
      // Log success
      await createEvent({
        eventType: 'EXCHANGE_RATES_UPDATED',
        resourceType: 'CURRENCY',
        severity: EventSeverity.INFO,
        metadata: {
          updatedAt: new Date().toISOString(),
          currencyCount: currencies.length,
        },
      });
    } catch (error) {
      console.error('Error updating all exchange rates:', error);
      
      // Log the error
      await createEvent({
        eventType: 'EXCHANGE_RATES_UPDATE_ERROR',
        resourceType: 'CURRENCY',
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Round amount according to currency rules
   * @private
   */
  private static roundAmountForCurrency(amount: number, currencyCode: string): number {
    const currency = this.getCurrencyByCode(currencyCode);
    
    if (!currency) {
      // Default to 2 decimal places if currency not found
      return Math.round(amount);
    }
    
    // For zero decimal currencies like JPY
    if (currency.decimalPlaces === 0) {
      return Math.round(amount);
    }
    
    // For regular currencies, maintain cents
    return Math.round(amount);
  }
} 