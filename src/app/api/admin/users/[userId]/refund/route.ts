import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user and their subscription
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get the latest payment for the subscription
    const subscription = await stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId,
      {
        expand: ['latest_invoice.payment_intent'],
      }
    );

    if (!subscription.latest_invoice) {
      return NextResponse.json(
        { error: 'No payment found to refund' },
        { status: 400 }
      );
    }

    const paymentIntent = (subscription.latest_invoice as any).payment_intent;

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'No payment intent found' },
        { status: 400 }
      );
    }

    // Create a refund
    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: 'requested_by_customer',
    });

    // Update subscription status
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        subscription_status: 'cancelled',
      },
    });

    return NextResponse.json({ message: 'Refund processed successfully' });
  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
} 