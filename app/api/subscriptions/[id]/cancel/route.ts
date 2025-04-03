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

    // Get request body
    const { cancelAtPeriodEnd = true, reason = '' } = await req.json();

    // Initialize the subscription service
    const subscriptionService = new SubscriptionService();

    // Cancel the subscription
    const result = await subscriptionService.cancelSubscription({
      subscriptionId: id,
      cancelAtPeriodEnd,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cancel subscription' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        message: cancelAtPeriodEnd 
          ? 'Subscription scheduled for cancellation at the end of the billing period' 
          : 'Subscription canceled successfully',
        subscription: result.subscription 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'An error occurred while canceling subscription' },
      { status: 500 }
    );
  }
} 