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

    // Get the user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: {
          not: 'CANCELED',
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Format the response
    const formattedSubscription = {
      id: subscription.id,
      planName: subscription.plan?.name || 'Unknown Plan',
      status: subscription.status.toLowerCase(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      trialEndsAt: subscription.trialEndsAt?.toISOString(),
    };

    return NextResponse.json(formattedSubscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
} 