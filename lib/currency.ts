import { stripe } from './stripe';
import { createEvent, EventSeverity } from './events';
import { prisma } from './prisma';
import { Organization } from '@prisma/client';
import fetch from 'node-fetch';

export interface CurrencyConversionResult {
  amount: number;
  rate: number;
  timestamp: number;
}

// Exchange rate API endpoint
const OPEN_EXCHANGE_RATES_API = process.env.OPEN_EXCHANGE_RATES_URL || 'https://openexchangerates.org/api';
const OPEN_EXCHANGE_RATES_API_KEY = process.env.OPEN_EXCHANGE_RATES_API_KEY || '';

export interface TaxRate {
  rate: number;
  name: string;
  type: 'VAT' | 'GST' | 'HST' | 'PST' | 'SALES_TAX' | 'OTHER';
  jurisdiction: string;
  threshold?: number; // Threshold for when this tax rate applies (in local currency)
  isCompound?: boolean; // Whether this tax is applied on top of other taxes
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  lastUpdated: Date;
}

export class CurrencyService {
  private static supportedCurrencies = [
    { code: 'usd', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'eur', name: 'Euro', symbol: '€', decimalPlaces: 2 },
    { code: 'gbp', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
    { code: 'cad', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2 },
    { code: 'aud', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2 },
    { code: 'jpy', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
    { code: 'cny', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
    { code: 'inr', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
    { code: 'brl', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
    { code: 'mxn', name: 'Mexican Peso', symbol: '$', decimalPlaces: 2 },
    { code: 'sgd', name: 'Singapore Dollar', symbol: 'S$', decimalPlaces: 2 },
    { code: 'chf', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 }
  ];

  private static exchangeRates: Map<string, ExchangeRate> = new Map();
  private static readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

  // Region-specific tax rules
  private static taxRules: Record<string, TaxRate[]> = {
    // European Union VAT rates
    EU: [
      { rate: 0.21, name: 'EU Standard VAT', type: 'VAT', jurisdiction: 'European Union' }
    ],
    // Country-specific rules
    US: [
      { rate: 0.0, name: 'No Federal Sales Tax', type: 'SALES_TAX', jurisdiction: 'United States Federal' }
    ],
    CA: [
      { rate: 0.05, name: 'GST', type: 'GST', jurisdiction: 'Canada Federal' }
    ],
    GB: [
      { rate: 0.20, name: 'VAT', type: 'VAT', jurisdiction: 'United Kingdom' }
    ],
    JP: [
      { rate: 0.10, name: 'Consumption Tax', type: 'OTHER', jurisdiction: 'Japan' }
    ],
    AU: [
      { rate: 0.10, name: 'GST', type: 'GST', jurisdiction: 'Australia' }
    ],
    // Add more countries as needed
  };

  // US state-specific tax rates
  private static stateTaxRates: Record<string, TaxRate> = {
    CA: { rate: 0.0725, name: 'California Sales Tax', type: 'SALES_TAX', jurisdiction: 'California' },
    NY: { rate: 0.04, name: 'New York Sales Tax', type: 'SALES_TAX', jurisdiction: 'New York' },
    TX: { rate: 0.0625, name: 'Texas Sales Tax', type: 'SALES_TAX', jurisdiction: 'Texas' },
    FL: { rate: 0.06, name: 'Florida Sales Tax', type: 'SALES_TAX', jurisdiction: 'Florida' },
    // Add more US states as needed
  };

  // Canadian province-specific tax rates
  private static provinceTaxRates: Record<string, TaxRate> = {
    ON: { rate: 0.13, name: 'HST', type: 'HST', jurisdiction: 'Ontario', isCompound: false },
    QC: { rate: 0.09975, name: 'QST', type: 'PST', jurisdiction: 'Quebec', isCompound: true },
    BC: { rate: 0.07, name: 'PST', type: 'PST', jurisdiction: 'British Columbia', isCompound: false },
    // Add more provinces as needed
  };

  // EU VAT rates by country
  private static euVatRates: Record<string, TaxRate> = {
    DE: { rate: 0.19, name: 'German VAT', type: 'VAT', jurisdiction: 'Germany' },
    FR: { rate: 0.20, name: 'French VAT', type: 'VAT', jurisdiction: 'France' },
    ES: { rate: 0.21, name: 'Spanish VAT', type: 'VAT', jurisdiction: 'Spain' },
    IT: { rate: 0.22, name: 'Italian VAT', type: 'VAT', jurisdiction: 'Italy' },
    // Add more EU countries as needed
  };

  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyConversionResult> {
    if (fromCurrency.toLowerCase() === toCurrency.toLowerCase()) {
      return {
        amount,
        rate: 1,
        timestamp: Date.now()
      };
    }

    try {
      // First, try to use Stripe for exchange rates
      try {
        const exchangeRate = await stripe.exchangeRates.retrieve(toCurrency.toLowerCase());
        const rate = exchangeRate.rates[fromCurrency.toLowerCase()];

        if (rate) {
          // Convert amount with proper rounding based on currency decimal places
          const toCurrencyInfo = this.supportedCurrencies.find(c => c.code === toCurrency.toLowerCase());
          const decimalPlaces = toCurrencyInfo?.decimalPlaces ?? 2;
          const convertedAmount = this.roundToDecimalPlaces(amount * rate, decimalPlaces);

          return {
            amount: convertedAmount,
            rate,
            timestamp: Date.now()
          };
        }
      } catch (stripeError) {
        console.warn('Stripe exchange rate retrieval failed, falling back to alternative source', stripeError);
      }

      // If stripe fails, use Open Exchange Rates API as a fallback
      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = this.roundToDecimalPlaces(amount * exchangeRate, 2);

      return {
        amount: convertedAmount,
        rate: exchangeRate,
        timestamp: Date.now()
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
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      return {
        amount,
        rate: 1,
        timestamp: Date.now()
      };
    }
  }

  private static roundToDecimalPlaces(amount: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(amount * factor) / factor;
  }

  static async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency.toLowerCase() === toCurrency.toLowerCase()) {
      return amount;
    }

    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const toCurrencyInfo = this.supportedCurrencies.find(c => c.code === toCurrency.toLowerCase());
    const decimalPlaces = toCurrencyInfo?.decimalPlaces ?? 2;
    
    return this.roundToDecimalPlaces(amount * exchangeRate, decimalPlaces);
  }

  static async getExchangeRate(from: string, to: string): Promise<number> {
    if (from.toLowerCase() === to.toLowerCase()) return 1;

    const cacheKey = `${from.toLowerCase()}-${to.toLowerCase()}`;
    const cachedRate = this.exchangeRates.get(cacheKey);

    if (cachedRate && Date.now() - cachedRate.lastUpdated.getTime() < this.CACHE_DURATION) {
      return cachedRate.rate;
    }

    // Fetch from database or external API
    const rate = await this.fetchExchangeRate(from, to);
    
    this.exchangeRates.set(cacheKey, {
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      rate,
      lastUpdated: new Date()
    });

    return rate;
  }

  private static async fetchExchangeRate(from: string, to: string): Promise<number> {
    // First try to get from database
    const storedRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from.toLowerCase(),
        toCurrency: to.toLowerCase(),
        lastUpdated: {
          gte: new Date(Date.now() - this.CACHE_DURATION)
        }
      }
    });

    if (storedRate) {
      return storedRate.rate;
    }

    // If not in database or expired, fetch from external API
    try {
      if (!OPEN_EXCHANGE_RATES_API_KEY) {
        throw new Error('Exchange rate API key not configured');
      }
      
      const response = await fetch(
        `${OPEN_EXCHANGE_RATES_API}/latest.json?app_id=${OPEN_EXCHANGE_RATES_API_KEY}&base=USD&symbols=${from.toUpperCase()},${to.toUpperCase()}`
      );
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.rates || !data.rates[from.toUpperCase()] || !data.rates[to.toUpperCase()]) {
        throw new Error('Invalid exchange rate data');
      }
      
      // Calculate rate from USD-based rates
      const rateFrom = data.rates[from.toUpperCase()];
      const rateTo = data.rates[to.toUpperCase()];
      const exchangeRate = rateTo / rateFrom;
      
      // Store in database for future use
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: from.toLowerCase(),
          toCurrency: to.toLowerCase(),
          rate: exchangeRate,
          provider: 'OpenExchangeRates',
          lastUpdated: new Date()
        }
      });
      
      return exchangeRate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      throw new Error(`Failed to fetch exchange rate for ${from} to ${to}`);
    }
  }

  static async getTaxRate(organization: Organization): Promise<TaxRate[]> {
    // Get tax rates based on organization's location
    const country = organization.country || 'US';
    const state = organization.state;
    const isDigitalProduct = organization.metadata?.isDigitalProduct === true;
    const taxExempt = organization.metadata?.taxExempt === true;
    
    // If organization is tax exempt, return empty array
    if (taxExempt) {
      return [];
    }

    const taxRates: TaxRate[] = [];
    
    // For EU countries, apply VAT for digital services
    const isEUCountry = Object.keys(this.euVatRates).includes(country);
    
    if (isEUCountry && isDigitalProduct) {
      // For EU digital goods, use the VAT rate of the customer's country
      if (this.euVatRates[country]) {
        taxRates.push(this.euVatRates[country]);
      } else {
        // Default EU VAT rate if country-specific one not found
        taxRates.push(this.taxRules.EU[0]);
      }
    } 
    // For US, apply state tax
    else if (country === 'US' && state && this.stateTaxRates[state]) {
      taxRates.push(this.stateTaxRates[state]);
    }
    // For Canada, apply GST and provincial tax if applicable
    else if (country === 'CA') {
      // Always apply federal GST
      taxRates.push(this.taxRules.CA[0]);
      
      // Add provincial tax if applicable
      if (state && this.provinceTaxRates[state]) {
        taxRates.push(this.provinceTaxRates[state]);
      }
    }
    // For other countries, use country-specific tax rate
    else if (this.taxRules[country]) {
      taxRates.push(...this.taxRules[country]);
    }
    
    return taxRates;
  }

  static formatCurrency(amount: number, currency: string, options: { symbol?: boolean, locale?: string } = {}): string {
    const currencyCode = currency.toUpperCase();
    const locale = options.locale || 'en-US';
    const showSymbol = options.symbol !== false;
    
    return new Intl.NumberFormat(locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: showSymbol ? currencyCode : undefined,
      minimumFractionDigits: this.getCurrencyDecimalPlaces(currency),
      maximumFractionDigits: this.getCurrencyDecimalPlaces(currency)
    }).format(amount);
  }

  static getCurrencyDecimalPlaces(currency: string): number {
    return this.supportedCurrencies.find(c => c.code === currency.toLowerCase())?.decimalPlaces ?? 2;
  }

  static getSupportedCurrencies() {
    return this.supportedCurrencies;
  }

  static isSupportedCurrency(currency: string): boolean {
    return this.supportedCurrencies.some(c => c.code === currency.toLowerCase());
  }

  static getCurrencySymbol(currency: string): string | undefined {
    return this.supportedCurrencies.find(c => c.code === currency.toLowerCase())?.symbol;
  }

  static getCurrencyName(currency: string): string | undefined {
    return this.supportedCurrencies.find(c => c.code === currency.toLowerCase())?.name;
  }

  static async calculateTax(
    amount: number,
    currency: string,
    organization: Organization
  ): Promise<{
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    taxBreakdown: Array<{
      name: string;
      rate: number;
      amount: number;
      type: string;
      jurisdiction: string;
    }>;
  }> {
    const taxRates = await this.getTaxRate(organization);
    let totalTaxRate = 0;
    let totalTaxAmount = 0;
    let runningTotal = amount;
    
    const taxBreakdown = [];
    
    // Calculate each tax component
    for (const taxRate of taxRates) {
      let taxAmount: number;
      
      // For compound tax, apply on top of previous taxes
      if (taxRate.isCompound) {
        taxAmount = Math.round(runningTotal * taxRate.rate);
      } else {
        taxAmount = Math.round(amount * taxRate.rate);
      }
      
      totalTaxAmount += taxAmount;
      runningTotal += taxAmount;
      totalTaxRate += taxRate.rate;
      
      taxBreakdown.push({
        name: taxRate.name,
        rate: taxRate.rate,
        amount: taxAmount,
        type: taxRate.type,
        jurisdiction: taxRate.jurisdiction
      });
    }
    
    const totalAmount = amount + totalTaxAmount;

    return {
      taxRate: totalTaxRate,
      taxAmount: totalTaxAmount,
      totalAmount,
      taxBreakdown
    };
  }

  static async updateExchangeRates(): Promise<void> {
    // Get all currency pairs we need to update
    const currencyPairs = await prisma.exchangeRate.findMany({
      select: {
        fromCurrency: true,
        toCurrency: true
      }
    });

    // Update each currency pair
    for (const pair of currencyPairs) {
      try {
        await this.fetchExchangeRate(pair.fromCurrency, pair.toCurrency);
      } catch (error) {
        console.error(`Failed to update exchange rate for ${pair.fromCurrency}-${pair.toCurrency}:`, error);
      }
    }
  }
} 