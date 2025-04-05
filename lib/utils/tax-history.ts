import { prisma } from '@/lib/prisma';
import { TaxRate } from '@prisma/client';

export async function createTaxRateHistory(
  taxRate: TaxRate,
  changedBy: string,
  reason: string
) {
  return prisma.taxRateHistory.create({
    data: {
      taxRateId: taxRate.id,
      name: taxRate.name,
      rate: taxRate.percentage,
      country: taxRate.country,
      state: taxRate.state,
      description: taxRate.description,
      isActive: taxRate.active,
      changedBy,
      reason,
    },
  });
}

export async function getTaxRateHistory(taxRateId: string) {
  return prisma.taxRateHistory.findMany({
    where: {
      taxRateId,
    },
    orderBy: {
      changedAt: 'desc',
    },
    include: {
      changedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getTaxRateHistoryForPeriod(
  organizationId: string,
  fromDate: Date,
  toDate: Date
) {
  return prisma.taxRateHistory.findMany({
    where: {
      taxRate: {
        organizationId,
      },
      changedAt: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: {
      changedAt: 'desc',
    },
    include: {
      taxRate: true,
      changedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getTaxRateHistoryByDateRange(
  taxRateId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.taxRateHistory.findMany({
    where: {
      taxRateId,
      changedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      changedAt: 'desc',
    },
  });
}

export async function getActiveTaxRateAtDate(
  taxRateId: string,
  date: Date
) {
  return prisma.taxRateHistory.findFirst({
    where: {
      taxRateId,
      changedAt: {
        lte: date,
      },
      isActive: true,
    },
    orderBy: {
      changedAt: 'desc',
    },
  });
}

export async function getTaxRateChangesByUser(
  taxRateId: string,
  userId: string
) {
  return prisma.taxRateHistory.findMany({
    where: {
      taxRateId,
      changedBy: userId,
    },
    orderBy: {
      changedAt: 'desc',
    },
  });
} 