import { prisma } from '@/lib/prisma';

interface ExchangeRate {
  currency: string;
  rate: number;
  lastUpdated: Date;
}

export class CurrencyService {
  private static instance: CurrencyService;
  private exchangeRates: Map<string, ExchangeRate> = new Map();

  private constructor() {}

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  // ...rest of the code from the prompt...
}

export const currencyService = CurrencyService.getInstance();

export function formatCurrency(
  amount: number,
  currency: string,
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
