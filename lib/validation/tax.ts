import { TaxRate } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';

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
      message: 'Name is required'
    });
  }

  // Validate rate
  if (typeof data.rate !== 'number' || data.rate < 0 || data.rate > 100) {
    errors.push({
      field: 'rate',
      message: 'Rate must be between 0 and 100'
    });
  }

  // Validate country
  if (!data.country?.trim()) {
    errors.push({
      field: 'country',
      message: 'Country is required'
    });
  } else if (data.country.length !== 2) {
    errors.push({
      field: 'country',
      message: 'Country must be a 2-letter ISO code'
    });
  }

  // Validate state format if provided
  if (data.state && data.state.length > 0) {
    if (data.state.length > 3 && data.country === 'US') {
      errors.push({
        field: 'state',
        message: 'State must be a valid state code for US'
      });
    }
  }

  // Check for overlapping tax rates
  const overlappingRate = await prisma.taxRate.findFirst({
    where: {
      organizationId,
      country: data.country,
      state: data.state || null,
      isActive: true,
      id: { not: data.id }, // Exclude current rate when updating
    }
  });

  if (overlappingRate) {
    errors.push({
      field: 'location',
      message: 'An active tax rate already exists for this location'
    });
  }

  // Log validation attempt
  await createEvent({
    type: 'TAX_RATE_VALIDATION',
    resourceType: 'TAX_RATE',
    resourceId: data.id || 'new',
    metadata: {
      organizationId,
      errors: errors.length > 0 ? errors : undefined,
      data
    }
  });

  return errors;
}

export async function validateTaxRateDelete(
  taxRateId: string,
  organizationId: string
): Promise<TaxRateValidationError[]> {
  const errors: TaxRateValidationError[] = [];

  // Check if tax rate is being used in any active invoices
  const usedInInvoices = await prisma.invoice.count({
    where: {
      organizationId,
      taxRates: {
        some: {
          id: taxRateId
        }
      },
      status: {
        in: ['DRAFT', 'PENDING', 'PAID']
      }
    }
  });

  if (usedInInvoices > 0) {
    errors.push({
      field: 'id',
      message: 'Cannot delete a tax rate that is used in active invoices'
    });
  }

  return errors;
}