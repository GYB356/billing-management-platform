import { prisma } from '@/lib/prisma';
import { TaxReport } from '@/types/tax';

export async function cacheTaxReport(
  organizationId: string,
  report: TaxReport,
  period: { startDate: Date; endDate: Date }
) {
  await prisma.taxReportCache.create({
    data: {
      organizationId,
      report: report as any,
      periodStart: period.startDate,
      periodEnd: period.endDate,
    },
  });
}

export async function getCachedReport(
  organizationId: string,
  period: { startDate: Date; endDate: Date }
) {
  return prisma.taxReportCache.findFirst({
    where: {
      organizationId,
      periodStart: period.startDate,
      periodEnd: period.endDate,
    },
  });
}

export async function clearReportCache(organizationId: string) {
  await prisma.taxReportCache.deleteMany({
    where: {
      organizationId,
    },
  });
} 