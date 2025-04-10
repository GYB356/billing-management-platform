import { TaxRate } from '@/types/tax';

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxDetails: {
    rate: number;
    amount: number;
    name: string;
  }[];
}

export function calculateTax(
  amount: number,
  taxRates: TaxRate[]
): TaxCalculationResult {
  const activeTaxRates = taxRates.filter((rate) => rate.isActive);
  
  const taxDetails = activeTaxRates.map((rate) => ({
    rate: rate.rate,
    amount: (amount * rate.rate) / 100,
    name: rate.name,
  }));

  const taxAmount = taxDetails.reduce((sum, detail) => sum + detail.amount, 0);

  return {
    subtotal: amount,
    taxAmount,
    total: amount + taxAmount,
    taxDetails,
  };
}

export function formatTaxAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatTaxRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

export function generateTaxSummary(taxDetails: TaxCalculationResult['taxDetails']): string {
  return taxDetails
    .map((detail) => `${detail.name} (${formatTaxRate(detail.rate)})`)
    .join(', ');
} 