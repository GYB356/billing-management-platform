import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const PLANS = {
  basic: {
    name: 'Basic Plan',
    price: process.env.STRIPE_BASIC_PRICE_ID,
    features: ['Basic features', 'Up to 5 projects', 'Email support'],
  },
  pro: {
    name: 'Pro Plan',
    price: process.env.STRIPE_PRO_PRICE_ID,
    features: ['All Basic features', 'Unlimited projects', 'Priority support', 'Advanced analytics'],
  },
  enterprise: {
    name: 'Enterprise Plan',
    price: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: ['All Pro features', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
  },
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await req.json();
    const plan = PLANS[planId as keyof typeof PLANS];

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.price,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planId,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
} 