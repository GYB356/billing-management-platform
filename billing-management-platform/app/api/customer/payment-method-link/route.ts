import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: {
          not: 'CANCELED',
        },
      },
    });

    if (!subscription?.metadata?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.metadata.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/customer/portal`,
      flow_data: {
        type: 'payment_method_update',
      },
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating payment method update link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment method update link' },
      { status: 500 }
    );
  }
}