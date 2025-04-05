import { prisma } from '@/lib/prisma';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

interface CurrencyFormatOptions {
  style?: 'decimal' | 'currency';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export class CurrencyService {
  private readonly defaultCurrency = 'USD';
  private readonly exchangeRateValidityHours = 24;

  /**
   * Convert amount between currencies
   */
  public async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return Math.round(amount * rate);
  }

  /**
   * Format amount according to currency
   */
  public format(
    amount: number,
    currency: string,
    options: CurrencyFormatOptions = {}
  ): string {
    const {
      style = 'currency',
      minimumFractionDigits = 2,
      maximumFractionDigits = 2
    } = options;

    return new Intl.NumberFormat('en-US', {
      style,
      currency,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(amount / 100); // Convert cents to whole units
  }

  /**
   * Get exchange rate between two currencies
   */
  private async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // Check cache first
    const cachedRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        updatedAt: {
          gte: new Date(Date.now() - this.exchangeRateValidityHours * 60 * 60 * 1000)
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (cachedRate) {
      return cachedRate.rate;
    }

    // Fetch new rate from external service
    const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);

    // Cache the new rate
    await prisma.exchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        updatedAt: new Date()
      }
    });

    return rate;
  }

  /**
   * Fetch current exchange rate from external service
   */
  private async fetchExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // This would be implemented to use a real exchange rate API
    // For now, return a placeholder rate
    if (fromCurrency === this.defaultCurrency) {
      return this.getPlaceholderRate(toCurrency);
    } else if (toCurrency === this.defaultCurrency) {
      return 1 / this.getPlaceholderRate(fromCurrency);
    } else {
      // Cross rate: first convert to USD, then to target currency
      const toUSD = 1 / this.getPlaceholderRate(fromCurrency);
      return toUSD * this.getPlaceholderRate(toCurrency);
    }
  }

  /**
   * Get placeholder exchange rates for demonstration
   */
  private getPlaceholderRate(currency: string): number {
    const rates: Record<string, number> = {
      EUR: 0.85,
      GBP: 0.73,
      JPY: 110.0,
      AUD: 1.35,
      CAD: 1.25,
      CHF: 0.92,
      CNY: 6.45,
      INR: 74.5,
      NZD: 1.45,
      BRL: 5.20
    };

    return rates[currency] || 1;
  }

  /**
   * Round amount according to currency
   */
  public roundAmount(amount: number, currency: string): number {
    const precision = this.getCurrencyPrecision(currency);
    const multiplier = Math.pow(10, precision);
    return Math.round(amount * multiplier) / multiplier;
  }

  /**
   * Get decimal precision for currency
   */
  private getCurrencyPrecision(currency: string): number {
    const precisions: Record<string, number> = {
      JPY: 0,
      KRW: 0,
      HUF: 0,
      TWD: 0,
      CLP: 0
    };

    return precisions[currency] || 2;
  }

  /**
   * Get supported currencies
   */
  public async getSupportedCurrencies(): Promise<string[]> {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    });

    return currencies.map(c => c.code);
  }

  /**
   * Validate currency code
   */
  public async isValidCurrency(currency: string): Promise<boolean> {
    const supportedCurrencies = await this.getSupportedCurrencies();
    return supportedCurrencies.includes(currency);
  }

  /**
   * Get currency symbol
   */
  public getCurrencySymbol(currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
      .format(0)
      .replace(/[0-9]/g, '')
      .trim();
  }

  /**
   * Convert currency display format
   */
  public formatForDisplay(
    amount: number,
    currency: string,
    locale: string = 'en-US'
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol'
    }).format(amount / 100); // Convert cents to whole units
  }

  /**
   * Format amount range
   */
  public formatRange(
    minAmount: number,
    maxAmount: number,
    currency: string,
    locale: string = 'en-US'
  ): string {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol'
    });

    return `${formatter.format(minAmount / 100)} - ${formatter.format(maxAmount / 100)}`;
  }

  /**
   * Get currency metadata
   */
  public async getCurrencyMetadata(currency: string) {
    const metadata = await prisma.currency.findUnique({
      where: { code: currency }
    });

    if (!metadata) {
      throw new Error(`Currency ${currency} not found`);
    }

    return {
      code: metadata.code,
      name: metadata.name,
      symbol: metadata.symbol,
      precision: metadata.precision,
      thousandsSeparator: metadata.thousandsSeparator,
      decimalSeparator: metadata.decimalSeparator,
      symbolPosition: metadata.symbolPosition
    };
  }

  /**
   * Parse currency string to number
   */
  public parseCurrencyString(value: string, currency: string): number {
    // Remove currency symbol and any non-numeric characters except decimal point
    const numericString = value
      .replace(this.getCurrencySymbol(currency), '')
      .replace(/[^0-9.]/g, '');

    // Parse to number and convert to cents
    return Math.round(parseFloat(numericString) * 100);
  }
}