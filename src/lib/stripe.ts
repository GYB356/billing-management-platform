import Stripe from 'stripe';
import prisma from '@/lib/prisma';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface SubscriptionPlan {
  name: string;
  priceId: string;
  price: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    name: 'Basic',
    priceId: process.env.STRIPE_BASIC_PRICE_ID!,
    price: 9.99,
    features: [
      'Basic features',
      'Email support',
      '1 user',
      'Basic analytics',
    ],
  },
  {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: 19.99,
    features: [
      'All Basic features',
      'Priority support',
      '5 users',
      'Advanced analytics',
      'API access',
    ],
  },
  {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    price: 49.99,
    features: [
      'All Pro features',
      '24/7 support',
      'Unlimited users',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
];

export async function createStripeCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name,
  });
  return customer;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
    metadata: {
      userId,
    },
  });
  return session;
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: {
      stripeCustomerId: subscription.customer as string,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const plan = SUBSCRIPTION_PLANS.find(
    (p) => p.priceId === subscription.items.data[0].price.id
  );

  const subscriptionData = {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: subscription.status,
    planName: plan?.name || 'Unknown',
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    lastPaymentStatus: subscription.latest_invoice as string,
  };

  await prisma.subscription.upsert({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    create: {
      ...subscriptionData,
      userId: user.id,
    },
    update: subscriptionData,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      subscription_status: subscription.status,
    },
  });
} 