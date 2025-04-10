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
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get request body
    const { planId, quantity, prorate = true } = await req.json();

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Validate that requested plan exists
    const newPlan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Don't proceed if it's the same plan with the same quantity
    if (
      subscription.planId === planId &&
      subscription.quantity === (quantity || 1)
    ) {
      return NextResponse.json(
        { message: 'No changes to apply' },
        { status: 200 }
      );
    }

    // Initialize the subscription service
    const subscriptionService = new SubscriptionService();

    // Update the subscription
    const result = await subscriptionService.updateSubscription({
      subscriptionId: id,
      newPlanId: planId, 
      quantity: quantity || 1,
      prorate,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update subscription' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        message: 'Subscription updated successfully',
        subscription: result.subscription 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating subscription' },
      { status: 500 }
    );
  }
} 