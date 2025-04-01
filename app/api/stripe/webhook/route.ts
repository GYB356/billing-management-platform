import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (!userId || !planId) {
          throw new Error('Missing metadata');
        }

        // Create or update subscription
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            planName: planId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(
              (session.subscription as any).current_period_end * 1000
            ),
          },
          update: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            planName: planId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(
              (session.subscription as any).current_period_end * 1000
            ),
          },
        });

        // Update user subscription status
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription_status: 'active',
            stripeCustomerId: session.customer as string,
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          throw new Error('Missing metadata');
        }

        await prisma.subscription.update({
          where: { userId },
          data: {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription_status: subscription.status,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          throw new Error('Missing metadata');
        }

        await prisma.subscription.update({
          where: { userId },
          data: {
            status: 'canceled',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription_status: 'canceled',
          },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 