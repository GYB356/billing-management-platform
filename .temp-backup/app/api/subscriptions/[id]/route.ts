import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateUsageCharges } from '@/lib/usage';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } } // Using 'id' consistently
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const subscriptionId = params.id;

    // Verify user has access to this subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: {
          include: {
            users: {
              where: { id: session.user.id },
            },
          },
        },
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
    });

    if (!subscription) {
      return new NextResponse('Subscription not found', { status: 404 });
    }

    if (!subscription.organization.users.length) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get current period's usage records
    const currentPeriodStart = subscription.currentPeriodStart || new Date();
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        recordedAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      include: {
        feature: true,
      },
    });

    // Calculate current usage and costs for each feature
    const features = subscription.plan.planFeatures.map((planFeature) => {
      const feature = planFeature.feature;
      const featureUsage = usageRecords.filter(
        (record) => record.featureId === feature.id
      );
      const currentUsage = featureUsage.reduce(
        (sum, record) => sum + record.quantity,
        0
      );

      // Calculate cost based on usage
      const cost = featureUsage.reduce(
        (sum, record) => sum + calculateUsageCharges(record.quantity, feature),
        0
      );

      return {
        id: feature.id,
        name: feature.name,
        currentUsage,
        limit: feature.usageLimit,
        cost,
        unitName: feature.unitName,
      };
    });

    return NextResponse.json({
      subscription,
      features,
    });
  } catch (error) {
    console.error('Error fetching subscription data:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}