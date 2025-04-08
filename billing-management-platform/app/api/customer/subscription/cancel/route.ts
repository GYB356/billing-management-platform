import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST() {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Get the Stripe subscription ID from metadata
    const stripeSubscriptionId = subscription.metadata?.stripeSubscriptionId;
    
    if (stripeSubscriptionId) {
      // Cancel the subscription at period end in Stripe
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update the subscription in the database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
} 