import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active pricing plans with their features
    const plans = await prisma.pricingPlan.findMany({
      where: {
        isActive: true,
      },
      include: {
        planFeatures: {
          include: {
            feature: true,
          },
        },
      },
      orderBy: {
        price: 'asc',
      },
    });

    // Transform the data to match the frontend interface
    const transformedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      features: plan.planFeatures.map((pf) => pf.feature.name),
    }));

    return NextResponse.json(transformedPlans);
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing plans' },
      { status: 500 }
    );
  }
} 