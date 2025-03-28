import { NextResponse } from 'next/server';
import { SubscriptionService } from '../../../../../lib/services/subscription-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';

const subscriptionService = new SubscriptionService();

export async function POST(
  request: Request,
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
    const { cancelAtPeriodEnd = true } = await request.json();

    // Cancel the subscription
    const result = await subscriptionService.cancelSubscription({
      subscriptionId: id,
      cancelAtPeriodEnd,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        subscription: result.subscription 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
} 