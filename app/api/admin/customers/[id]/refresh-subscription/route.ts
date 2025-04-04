import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        subscriptions: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Fetch subscription data from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      customer.subscriptions[0]?.stripeSubscriptionId || ''
    );

    // Update subscription in database
    const subscription = await prisma.subscription.update({
      where: { id: customer.subscriptions[0]?.id },
      data: {
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        endedAt: stripeSubscription.ended_at
          ? new Date(stripeSubscription.ended_at * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to refresh subscription' },
      { status: 500 }
    );
  }
} 