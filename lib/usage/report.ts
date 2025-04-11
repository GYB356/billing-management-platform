import { UsageReport, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

interface FeatureUsage {
  name: string;
  usage: number;
  limit: number;
  unit: string;
}

interface GenerateReportOptions {
  customerId: string;
  subscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
}

export async function generateUsageReport({
  customerId,
  subscriptionId,
  periodStart,
  periodEnd,
}: GenerateReportOptions): Promise<UsageReport> {
  // Get all features for the subscription
  const subscription = subscriptionId
    ? await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: {
            include: {
              planFeatures: {
                include: {
                  feature: true,
                },
              },
            },
          },
        },
      })
    : null;

  // Get usage records for the period
  const usageRecords = await prisma.usageRecord.findMany({
    where: {
      customerId,
      subscriptionId,
      timestamp: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    include: {
      feature: true,
    },
  });

  // Calculate usage for each feature
  const featureUsage: FeatureUsage[] = [];
  let totalUsage = 0;
  let maxPercentOfLimit = 0;

  if (subscription) {
    for (const planFeature of subscription.plan.planFeatures) {
      const feature = planFeature.feature;
      const records = usageRecords.filter((r) => r.featureId === feature.id);
      const usage = records.reduce((sum, record) => sum + record.quantity, 0);
      const limits = planFeature.limits
        ? (JSON.parse(planFeature.limits as string) as { maxValue: number })
        : null;

      const limit = limits?.maxValue || Infinity;
      const percentOfLimit =
        limit === Infinity ? 0 : (usage / limit) * 100;

      maxPercentOfLimit = Math.max(maxPercentOfLimit, percentOfLimit);
      totalUsage += usage;

      featureUsage.push({
        name: feature.name,
        usage,
        limit,
        unit: feature.unitLabel || 'units',
      });
    }
  }

  // Calculate cost estimate based on usage
  const costEstimate = await calculateCostEstimate(
    customerId,
    subscriptionId,
    featureUsage
  );

  // Create usage report
  return prisma.usageReport.create({
    data: {
      customerId,
      subscriptionId,
      periodStart,
      periodEnd,
      features: featureUsage as Prisma.JsonValue,
      totalUsage,
      percentOfLimit: maxPercentOfLimit,
      costEstimate,
    },
  });
}

async function calculateCostEstimate(
  customerId: string,
  subscriptionId: string | undefined,
  featureUsage: FeatureUsage[]
): Promise<number> {
  if (!subscriptionId) return 0;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: {
        include: {
          pricingTiers: true,
        },
      },
    },
  });

  if (!subscription) return 0;

  // Base subscription cost
  let totalCost = subscription.plan.basePrice || 0;

  // Add usage-based costs
  for (const feature of featureUsage) {
    const pricingTiers = subscription.plan.pricingTiers;
    if (!pricingTiers.length) continue;

    // Find applicable tier
    const applicableTier = pricingTiers
      .filter((tier) => !tier.upTo || tier.upTo >= feature.usage)
      .sort((a, b) => (a.upTo || Infinity) - (b.upTo || Infinity))[0];

    if (applicableTier) {
      if (applicableTier.flatFee) {
        totalCost += applicableTier.flatFee;
      }
      if (applicableTier.perUnitFee) {
        totalCost += feature.usage * applicableTier.perUnitFee;
      }
    }
  }

  return totalCost;
}

export async function getUsageReports(customerId: string, limit = 10) {
  return prisma.usageReport.findMany({
    where: { customerId },
    orderBy: { generatedAt: 'desc' },
    take: limit,
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });
}

export async function generateMonthlyReport(customerId: string) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      customerId,
      status: 'ACTIVE',
    },
  });

  const reports = await Promise.all(
    subscriptions.map((subscription) =>
      generateUsageReport({
        customerId,
        subscriptionId: subscription.id,
        periodStart: firstDayOfMonth,
        periodEnd: lastDayOfMonth,
      })
    )
  );

  return reports;
}
