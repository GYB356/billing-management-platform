import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer and their active subscription
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const activeSubscription = customer.subscriptions[0];

    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Cancel the subscription in Stripe
    await stripe.subscriptions.update(activeSubscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update the subscription in the database
    await prisma.subscription.update({
      where: { id: activeSubscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Create a cancellation record
    await prisma.subscriptionCancellation.create({
      data: {
        subscriptionId: activeSubscription.id,
        reason: 'User requested cancellation',
        effectiveDate: new Date(activeSubscription.currentPeriodEnd),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
