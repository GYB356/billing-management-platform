import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the active subscription for the user's organization
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id
            }
          }
        },
        status: 'ACTIVE'
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: {
                feature: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get usage records for current billing period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        recordedAt: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd
        }
      },
      include: {
        feature: true
      }
    });

    // Calculate metrics for each feature
    const metrics = subscription.plan.planFeatures.map(planFeature => {
      const feature = planFeature.feature;
      const featureUsage = usageRecords
        .filter(record => record.featureId === feature.id)
        .reduce((total, record) => total + record.quantity, 0);

      const included = planFeature.includedUnits || 0;
      const limit = planFeature.usageLimit;
      const overage = Math.max(featureUsage - included, 0);

      return {
        featureId: feature.id,
        featureName: feature.name,
        included,
        current: featureUsage,
        limit,
        unit: feature.unit || 'units',
        overage,
        overageRate: planFeature.overageUnitPrice
      };
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      metrics
    });
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage summary' },
      { status: 500 }
    );
  }
}