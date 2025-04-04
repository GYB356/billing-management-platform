import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SubscriptionService } from '@/lib/services/subscription-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get subscription id from params
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Validate that this subscription belongs to the authenticated user
    const subscription = await prisma.subscription.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Make sure the subscription is in a state that can be paused
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active subscriptions can be paused' },
        { status: 400 }
      );
    }

    // Initialize the subscription service
    const subscriptionService = new SubscriptionService();

    // Pause the subscription
    const result = await subscriptionService.pauseSubscription({
      subscriptionId: id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to pause subscription' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        message: 'Subscription paused successfully',
        subscription: result.subscription 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error pausing subscription:', error);
    return NextResponse.json(
      { error: 'An error occurred while pausing subscription' },
      { status: 500 }
    );
  }
} 