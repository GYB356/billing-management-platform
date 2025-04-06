import { prisma } from '@/lib/prisma';
import { createEvent, EventSeverity } from '@/lib/events';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  locales: string[];
  format: {
    symbolPosition: 'before' | 'after';
    thousandsSeparator: string;
    decimalSeparator: string;
    spaceBetweenAmountAndSymbol: boolean;
  };
}

interface RegionalConfig {
  currency: string;
  taxSystem: 'VAT' | 'GST' | 'SALES_TAX';
  defaultTaxRate: number;
  priceDisplayTaxInclusion: boolean;
  invoiceLanguages: string[];
  paymentMethods: string[];
}

export class CurrencyService {
  private static readonly EXCHANGE_RATE_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
  private static exchangeRateCache = new Map<string, { rate: number; timestamp: number }>();
  
  // Enhanced currency configurations
  private static readonly currencies: Currency[] = [
    {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      isActive: true,
      locales: ['en-US'],
      format: {
        symbolPosition: 'before',
        thousandsSeparator: ',',
        decimalSeparator: '.',
        spaceBetweenAmountAndSymbol: false,
      }
    },
    {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      decimalPlaces: 2,
      isActive: true,
      locales: ['de-DE', 'fr-FR', 'es-ES', 'it-IT'],
      format: {
        symbolPosition: 'after',
        thousandsSeparator: ' ',
        decimalSeparator: ',',
        spaceBetweenAmountAndSymbol: true,
      }
    },
    // Add more currencies with regional formatting rules
  ];

  private static readonly regionalConfigs: Record<string, RegionalConfig> = {
    EU: {
      currency: 'EUR',
      taxSystem: 'VAT',
      defaultTaxRate: 0.20,
      priceDisplayTaxInclusion: true,
      invoiceLanguages: ['en', 'de', 'fr', 'es', 'it'],
      paymentMethods: ['credit_card', 'sepa_debit', 'sofort', 'giropay'],
    },
    US: {
      currency: 'USD',
      taxSystem: 'SALES_TAX',
      defaultTaxRate: 0,
      priceDisplayTaxInclusion: false,
      invoiceLanguages: ['en'],
      paymentMethods: ['credit_card', 'ach'],
    },
    // Add more regional configurations
  };

  static async formatCurrencyForLocale(
    amount: number,
    currency: string,
    locale: string,
    options: {
      includeTax?: boolean;
      displayCurrency?: boolean;
      customFormat?: Partial<Currency['format']>;
    } = {}
  ): Promise<string> {
    const currencyConfig = this.currencies.find(c => c.code === currency.toUpperCase());
    if (!currencyConfig) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const format = { ...currencyConfig.format, ...options.customFormat };
    const regionalConfig = this.getRegionalConfigForLocale(locale);

    let formattedAmount = amount;
    if (options.includeTax && regionalConfig.priceDisplayTaxInclusion) {
      formattedAmount *= (1 + regionalConfig.defaultTaxRate);
    }

    const parts = new Intl.NumberFormat(locale, {
      minimumFractionDigits: currencyConfig.decimalPlaces,
      maximumFractionDigits: currencyConfig.decimalPlaces,
    }).formatToParts(formattedAmount);

    let result = '';
    const symbol = options.displayCurrency ? currencyConfig.symbol : '';
    const space = format.spaceBetweenAmountAndSymbol ? ' ' : '';

    if (format.symbolPosition === 'before' && symbol) {
      result += symbol + space;
    }

    parts.forEach(part => {
      switch (part.type) {
        case 'group':
          result += format.thousandsSeparator;
          break;
        case 'decimal':
          result += format.decimalSeparator;
          break;
        default:
          result += part.value;
      }
    });

    if (format.symbolPosition === 'after' && symbol) {
      result += space + symbol;
    }

    return result;
  }

  static getRegionalConfigForLocale(locale: string): RegionalConfig {
    const region = locale.split('-')[1] || locale;
    if (this.isEUCountry(region)) {
      return this.regionalConfigs.EU;
    }
    return this.regionalConfigs[region] || this.regionalConfigs.US;
  }

  static isEUCountry(country: string): boolean {
    const euCountries = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'GR', 'IE', 'AT', 'FI', 'SE', 'DK'];
    return euCountries.includes(country.toUpperCase());
  }

  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    options: {
      includeDetails?: boolean;
      roundingMode?: 'ceil' | 'floor' | 'round';
    } = {}
  ): Promise<number | { amount: number; rate: number; timestamp: number }> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;
    
    const roundedAmount = this.roundAmount(convertedAmount, toCurrency, options.roundingMode);
    
    if (options.includeDetails) {
      return {
        amount: roundedAmount,
        rate,
        timestamp: Date.now(),
      };
    }
    
    return roundedAmount;
  }

  private static roundAmount(
    amount: number,
    currency: string,
    mode: 'ceil' | 'floor' | 'round' = 'round'
  ): number {
    const currencyConfig = this.currencies.find(c => c.code === currency.toUpperCase());
    const multiplier = Math.pow(10, currencyConfig?.decimalPlaces || 2);
    
    switch (mode) {
      case 'ceil':
        return Math.ceil(amount * multiplier) / multiplier;
      case 'floor':
        return Math.floor(amount * multiplier) / multiplier;
      default:
        return Math.round(amount * multiplier) / multiplier;
    }
  }

  private static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cached = this.exchangeRateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.EXCHANGE_RATE_CACHE_TTL) {
      return cached.rate;
    }

    try {
      const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
      this.exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() });
      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      if (cached) {
        console.warn('Using stale exchange rate from cache');
        return cached.rate;
      }
      throw error;
    }
  }

  private static async fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Try Stripe first for real-time rates
    try {
      const stripeRate = await stripe.exchangeRates.retrieve(toCurrency);
      if (stripeRate.rates[fromCurrency]) {
        return 1 / stripeRate.rates[fromCurrency];
      }
    } catch (error) {
      console.warn('Stripe exchange rate fetch failed, falling back to backup service:', error);
    }

    // Fallback to exchange rate API
    const response = await fetch(
      `https://api.exchangerate.host/convert?from=${fromCurrency}&to=${toCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.result) {
      throw new Error('Invalid exchange rate data received');
    }

    await this.logExchangeRateUpdate(fromCurrency, toCurrency, data.result);
    return data.result;
  }

  private static async logExchangeRateUpdate(
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Promise<void> {
    await createEvent({
      eventType: 'EXCHANGE_RATE_UPDATED',
      resourceType: 'CURRENCY',
      severity: EventSeverity.INFO,
      metadata: {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: new Date().toISOString(),
      },
    });

    await prisma.exchangeRate.upsert({
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
  }
}