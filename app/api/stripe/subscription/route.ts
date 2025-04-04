import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscription: true,
      },
    });

    if (!user?.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId
    );

    return NextResponse.json({
      subscription: {
        ...subscription,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Error fetching subscription' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscription: true,
      },
    });

    if (!user?.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    switch (action) {
      case 'cancel': {
        const subscription = await stripe.subscriptions.update(
          user.subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
        );

        await prisma.subscription.update({
          where: { userId: user.id },
          data: {
            cancelAtPeriodEnd: true,
          },
        });

        return NextResponse.json({ subscription });
      }

      case 'resume': {
        const subscription = await stripe.subscriptions.update(
          user.subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: false,
          }
        );

        await prisma.subscription.update({
          where: { userId: user.id },
          data: {
            cancelAtPeriodEnd: false,
          },
        });

        return NextResponse.json({ subscription });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing subscription:', error);
    return NextResponse.json(
      { error: 'Error managing subscription' },
      { status: 500 }
    );
  }
} 