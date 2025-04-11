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

    const body = await req.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Get customer and their active subscription
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get the new plan details
    const newPlan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const activeSubscription = customer.subscriptions[0];

    if (activeSubscription) {
      // Update existing subscription
      if (activeSubscription.planId === planId) {
        return NextResponse.json(
          { error: 'Already subscribed to this plan' },
          { status: 400 }
        );
      }

      // Update the subscription in Stripe
      await stripe.subscriptions.update(activeSubscription.stripeSubscriptionId, {
        items: [{
          id: activeSubscription.stripeSubscriptionItemId,
          price: newPlan.stripePriceId,
        }],
        proration_behavior: 'always_invoice',
      });

      // Update the subscription in the database
      await prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          planId: newPlan.id,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create a new subscription
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.stripeCustomerId,
        type: 'card',
      });

      if (paymentMethods.data.length === 0) {
        return NextResponse.json(
          { error: 'No payment method available' },
          { status: 400 }
        );
      }

      // Create the subscription in Stripe
      const stripeSubscription = await stripe.subscriptions.create({
        customer: customer.stripeCustomerId,
        items: [{ price: newPlan.stripePriceId }],
        default_payment_method: paymentMethods.data[0].id,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Create the subscription in the database
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          planId: newPlan.id,
          status: 'ACTIVE',
          stripeSubscriptionId: stripeSubscription.id,
          stripeSubscriptionItemId: stripeSubscription.items.data[0].id,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plan change error:', error);
    return NextResponse.json(
      { error: 'Failed to change plan' },
      { status: 500 }
    );
  }
}
