// filepath: /workspaces/billing-management-platform/lib/services/exchangeRate.ts

export class ExchangeRateService {
  private rates: Record<string, number>;

  constructor() {
    this.rates = {};
  }

  setRate(currency: string, rate: number): void {
    this.rates[currency] = rate;
  }

  getRate(currency: string): number {
    return this.rates[currency] || 1;
  }

  convert(amount: number, fromCurrency: string, toCurrency: string): number {
    const fromRate = this.getRate(fromCurrency);
    const toRate = this.getRate(toCurrency);
    return (amount / fromRate) * toRate;
  }
}