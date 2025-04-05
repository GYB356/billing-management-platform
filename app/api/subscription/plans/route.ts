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

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'USD';
    const interval = searchParams.get('interval'); // monthly, yearly, etc.

    // Build query filters
    const where: any = {
      isActive: true,
    };

    if (interval) {
      where.interval = interval;
    }

    // Get all active plans with features
    const plans = await prisma.plan.findMany({
      where,
      include: {
        features: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        tiers: {
          orderBy: {
            upTo: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Get current subscription for comparison
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: {
        planId: true,
      },
    });

    // Format plans with current plan indicator and feature comparison
    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      isCurrent: plan.id === currentSubscription?.planId,
      features: plan.features.map(feature => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        value: feature.includedUnits 
          ? `${feature.includedUnits} ${feature.unitName || 'units'}`
          : feature.usageLimit 
            ? `Up to ${feature.usageLimit} ${feature.unitName || 'units'}`
            : 'Unlimited',
        included: true,
      })),
      tiers: plan.tiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        upTo: tier.upTo,
        price: tier.unitPrice,
        flatFee: tier.flatFee,
      })),
      trialDays: plan.trialDays,
      setupFee: plan.setupFee,
      minimumUnits: plan.minimumUnits,
      isPopular: plan.isPopular,
      metadata: plan.metadata,
    }));

    return NextResponse.json(formattedPlans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}