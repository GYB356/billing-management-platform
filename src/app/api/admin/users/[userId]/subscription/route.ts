import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await request.json();

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

    // Update subscription in Stripe if it exists
    if (user.subscription?.stripeSubscriptionId) {
      await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        status: status === 'active' ? 'active' : 'canceled',
        cancel_at_period_end: status === 'cancelled',
      });
    }

    // Update subscription status in database
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        subscription_status: status,
      },
    });

    return NextResponse.json({ message: 'Subscription status updated successfully' });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription status' },
      { status: 500 }
    );
  }
} 