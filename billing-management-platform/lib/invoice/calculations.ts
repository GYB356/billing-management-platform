import { InvoiceItem } from '@prisma/client';

export interface TaxRate {
  rate: number;
  description: string;
}

export interface ProrationConfig {
  startDate: Date;
  endDate: Date;
  billingCycleStart: Date;
  billingCycleEnd: Date;
}

export function calculateSubtotal(items: InvoiceItem[]): number {
  return items.reduce((total, item) => {
    return total + (item.quantity * item.unitPrice);
  }, 0);
}

export function calculateTax(subtotal: number, taxRate: TaxRate): number {
  return subtotal * (taxRate.rate / 100);
}

export function calculateTotal(subtotal: number, tax: number): number {
  return subtotal + tax;
}

export function calculateProratedAmount(
  fullAmount: number,
  config: ProrationConfig
): number {
  const totalDays = getDaysBetween(config.billingCycleStart, config.billingCycleEnd);
  const usedDays = getDaysBetween(config.startDate, config.endDate);
  
  return (fullAmount / totalDays) * usedDays;
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function validateInvoiceItems(items: InvoiceItem[]): boolean {
  return items.every(item => 
    item.quantity > 0 && 
    item.unitPrice >= 0 && 
    typeof item.name === 'string' && 
    item.name.length > 0
  );
}

export function calculateDiscount(
  subtotal: number,
  discountPercentage: number
): number {
  if (discountPercentage < 0 || discountPercentage > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  return subtotal * (discountPercentage / 100);
}

export function calculateFinalAmount(
  subtotal: number,
  tax: number,
  discount: number
): number {
  return subtotal + tax - discount;
} 