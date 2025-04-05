import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Get the active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
      include: {
        pricingPlan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Get the new plan
    const newPlan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
    });

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // If the subscription has a Stripe ID, update it in Stripe
    if (subscription.stripeSubscriptionId) {
      try {
        // Get the price ID for the new plan
        const priceId = newPlan.stripePriceId;
        if (!priceId) {
          return NextResponse.json(
            { error: 'New plan has no Stripe price ID' },
            { status: 400 }
          );
        }

        // Update the subscription in Stripe
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: subscription.stripeSubscriptionId,
              price: priceId,
              proration_behavior: 'always_invoice',
            },
          ],
        });
      } catch (error) {
        console.error('Error updating Stripe subscription:', error);
        return NextResponse.json(
          { error: 'Failed to update subscription in Stripe' },
          { status: 500 }
        );
      }
    }

    // Update the subscription in the database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        pricingPlanId: newPlan.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
} 