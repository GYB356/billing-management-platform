import { TaxRate } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface TaxRateValidationError {
  field: string;
  message: string;
}

export async function validateTaxRate(
  data: Partial<TaxRate>,
  organizationId: string
): Promise<TaxRateValidationError[]> {
  const errors: TaxRateValidationError[] = [];

  // Validate name
  if (!data.name?.trim()) {
    errors.push({
      field: 'name',
      message: 'Name is required',
    });
  }

  // Validate percentage
  if (data.percentage !== undefined) {
    if (isNaN(data.percentage) || data.percentage < 0 || data.percentage > 100) {
      errors.push({
        field: 'percentage',
        message: 'Percentage must be between 0 and 100',
      });
    }
  }

  // Validate country
  if (!data.country?.trim()) {
    errors.push({
      field: 'country',
      message: 'Country is required',
    });
  }

  // Check for overlapping tax rates
  const overlappingRates = await prisma.taxRate.findFirst({
    where: {
      organizationId,
      country: data.country || undefined,
      state: data.state || null,
      id: {
        not: data.id || undefined,
      },
    },
  });

  if (overlappingRates) {
    errors.push({
      field: 'location',
      message: 'A tax rate already exists for this location',
    });
  }

  return errors;
}

export async function validateTaxRateOverlap(
  taxRate: TaxRate,
  organizationId: string
): Promise<TaxRateValidationError | null> {
  const overlappingRates = await prisma.taxRate.findMany({
    where: {
      organizationId,
      country: taxRate.country,
      state: taxRate.state || null,
      id: {
        not: taxRate.id,
      },
      active: true,
    },
  });

  if (overlappingRates.length > 0) {
    return {
      field: 'location',
      message: 'Active tax rates cannot overlap for the same location',
    };
  }

  return null;
}

export async function validateTaxRateHistory(
  taxRate: TaxRate,
  organizationId: string
): Promise<TaxRateValidationError | null> {
  // Check for historical conflicts
  const historicalRates = await prisma.taxRateHistory.findMany({
    where: {
      taxRateId: taxRate.id,
      changedAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      changedAt: 'desc',
    },
  });

  if (historicalRates.length > 0) {
    const latestHistory = historicalRates[0];
    if (latestHistory.isActive && !taxRate.active) {
      return {
        field: 'active',
        message: 'Cannot deactivate a tax rate that has been used in historical records',
      };
    }
  }

  return null;
}

export async function validateTaxRateDeletion(
  taxRate: TaxRate,
  organizationId: string
): Promise<TaxRateValidationError | null> {
  // Check if tax rate is being used in invoices
  const usedInInvoices = await prisma.invoiceTax.findFirst({
    where: {
      taxRateId: taxRate.id,
    },
  });

  if (usedInInvoices) {
    return {
      field: 'id',
      message: 'Cannot delete a tax rate that has been used in invoices',
    };
  }

  return null;
}