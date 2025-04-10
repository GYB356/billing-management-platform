import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Get subscription with plan features and usage records
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
        usageRecords: {
          where: {
            timestamp: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Calculate usage thresholds for each feature
    const thresholds = subscription.plan.features.map(feature => {
      if (!feature.usageLimit) return null;

      // Calculate current usage for this feature
      const featureUsage = subscription.usageRecords
        .filter(record => record.featureId === feature.id)
        .reduce((sum, record) => sum + record.quantity, 0);

      const percentage = featureUsage / feature.usageLimit;

      return {
        featureId: feature.id,
        featureName: feature.name,
        currentUsage: featureUsage,
        limit: feature.usageLimit,
        percentage,
        remainingUsage: Math.max(0, feature.usageLimit - featureUsage),
        status: getUsageStatus(percentage),
      };
    }).filter(Boolean); // Remove null values

    return NextResponse.json({ thresholds });
  } catch (error) {
    console.error('Error checking usage thresholds:', error);
    return NextResponse.json(
      { error: 'Failed to check usage thresholds' },
      { status: 500 }
    );
  }
}

function getUsageStatus(percentage: number): string {
  if (percentage >= 1) return 'EXCEEDED';
  if (percentage >= 0.9) return 'CRITICAL';
  if (percentage >= 0.75) return 'WARNING';
  if (percentage >= 0.5) return 'ATTENTION';
  return 'NORMAL';
}