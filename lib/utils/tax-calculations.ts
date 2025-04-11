import { TaxRate } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: TaxRate;
}

export async function calculateTax(
  amount: number,
  taxRateId: string,
  organizationId: string
): Promise<TaxCalculationResult> {
  const taxRate = await prisma.taxRate.findFirst({
    where: {
      id: taxRateId,
      organizationId,
      isActive: true,
    },
  });

  if (!taxRate) {
    throw new Error('Tax rate not found or inactive');
  }

  const taxAmount = (amount * taxRate.rate) / 100;
  const total = amount + taxAmount;

  return {
    subtotal: amount,
    taxAmount,
    total,
    taxRate,
  };
}

export async function calculateMultipleTaxes(
  amount: number,
  taxRateIds: string[],
  organizationId: string
): Promise<TaxCalculationResult[]> {
  const taxRates = await prisma.taxRate.findMany({
    where: {
      id: {
        in: taxRateIds,
      },
      organizationId,
      isActive: true,
    },
  });

  if (taxRates.length !== taxRateIds.length) {
    throw new Error('One or more tax rates not found or inactive');
  }

  return taxRates.map((taxRate) => {
    const taxAmount = (amount * taxRate.rate) / 100;
    const total = amount + taxAmount;

    return {
      subtotal: amount,
      taxAmount,
      total,
      taxRate,
    };
  });
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

export interface TaxSummary {
  subtotal: number;
  totalTax: number;
  total: number;
  taxRates: {
    name: string;
    rate: string;
    amount: string;
  }[];
}

export function generateTaxSummary(
  calculations: TaxCalculationResult[]
): TaxSummary {
  const subtotal = calculations[0]?.subtotal || 0;
  const totalTax = calculations.reduce((sum, calc) => sum + calc.taxAmount, 0);
  const total = subtotal + totalTax;

  const taxRates = calculations.map((calc) => ({
    name: calc.taxRate.name,
    rate: formatTaxRate(calc.taxRate.rate),
    amount: formatTaxAmount(calc.taxAmount),
  }));

  return {
    subtotal,
    totalTax,
    total,
    taxRates,
  };
}

export async function validateTaxRateForInvoice(
  taxRateId: string,
  invoiceDate: Date,
  organizationId: string
): Promise<boolean> {
  const taxRate = await prisma.taxRate.findFirst({
    where: {
      id: taxRateId,
      organizationId,
      isActive: true,
    },
  });

  if (!taxRate) {
    return false;
  }

  // Check if the tax rate was active at the invoice date
  const history = await prisma.taxRateHistory.findFirst({
    where: {
      taxRateId,
      changedAt: {
        lte: invoiceDate,
      },
    },
    orderBy: {
      changedAt: 'desc',
    },
  });

  return history?.isActive ?? false;
} 