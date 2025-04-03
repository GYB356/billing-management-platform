import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { handleSubscriptionUpdated } from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    let event;

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
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        const subscription = event.data.object;
        const { prisma } = await import('@/lib/prisma');
        
        await prisma.subscription.update({
          where: {
            stripe_subscription_id: subscription.id,
          },
          data: {
            status: 'canceled',
            current_period_end: new Date(subscription.current_period_end * 1000),
          },
        });

        await prisma.user.update({
          where: {
            stripe_customer_id: subscription.customer as string,
          },
          data: {
            subscription_status: 'canceled',
          },
        });
        break;

      case 'invoice.payment_failed':
        // Handle failed payment
        const invoice = event.data.object;
        const { prisma } = await import('@/lib/prisma');
        
        await prisma.subscription.update({
          where: {
            stripe_subscription_id: invoice.subscription as string,
          },
          data: {
            status: 'past_due',
          },
        });

        await prisma.user.update({
          where: {
            stripe_customer_id: invoice.customer as string,
          },
          data: {
            subscription_status: 'past_due',
          },
        });
        break;
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