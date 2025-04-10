import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get current billing period usage
    const currentPeriodUsage = await prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        timestamp: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      include: {
        feature: true,
      },
    });

    // Calculate feature usage and limits
    const features = subscription.plan.features.map(feature => {
      const featureUsage = currentPeriodUsage
        .filter(record => record.featureId === feature.id)
        .reduce((sum, record) => sum + record.quantity, 0);

      return {
        id: feature.id,
        name: feature.name,
        description: feature.description,
        included: feature.includedUnits,
        current: featureUsage,
        limit: feature.usageLimit,
        overage: Math.max(featureUsage - (feature.includedUnits || 0), 0),
        overageRate: feature.overageUnitPrice,
      };
    });

    // Format plan details
    const formattedPlan = {
      id: subscription.plan.id,
      name: subscription.plan.name,
      description: subscription.plan.description,
      price: subscription.plan.price,
      currency: subscription.plan.currency,
      interval: subscription.plan.interval,
      features: features,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
    };

    return NextResponse.json(formattedPlan);
  } catch (error) {
    console.error('Error fetching current plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current plan' },
      { status: 500 }
    );
  }
}