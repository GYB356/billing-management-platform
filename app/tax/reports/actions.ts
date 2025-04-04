'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateTaxReport } from '@/lib/utils/tax-calculations';
import { cacheTaxReport } from '@/lib/utils/tax-report-cache';

export async function generateReport(data: {
  startDate: string;
  endDate: string;
  taxRateIds: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  // Check for cached report
  const cachedReport = await prisma.taxReportCache.findFirst({
    where: {
      organizationId: session.user.organizationId,
      periodStart: new Date(data.startDate),
      periodEnd: new Date(data.endDate),
    },
  });

  if (cachedReport) {
    return cachedReport.report;
  }

  // Generate new report
  const report = await generateTaxReport(
    session.user.organizationId,
    new Date(data.startDate),
    new Date(data.endDate),
    data.taxRateIds
  );

  // Cache the report
  await cacheTaxReport(session.user.organizationId, report, {
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
  });

  return report;
} 