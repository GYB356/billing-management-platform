import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId: session.user.organizationId,
        status: {
          in: ['ACTIVE', 'TRIALING']
        }
      },
      include: {
        plan: true,
        usageRecords: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!subscription) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: subscription.id,
      status: subscription.status.toLowerCase(),
      planName: subscription.plan.name,
      currentPeriodEnd: subscription.endDate,
      price: subscription.plan.basePrice,
      currency: subscription.plan.currency,
      ...(subscription.usageRecords[0] && {
        usage: {
          current: subscription.usageRecords[0].quantity,
          limit: subscription.plan.usageLimit,
          unit: subscription.plan.usageType
        }
      })
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
} 