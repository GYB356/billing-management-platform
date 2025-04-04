import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { Subscription, PricingPlan, UsageRecord, Feature } from '@prisma/client';

export interface SubscriptionWithPlan extends Subscription {
  plan: PricingPlan;
}

export interface SubscriptionDetails {
  subscription: SubscriptionWithPlan;
  usage: (UsageRecord & { feature: Feature })[];
  usageByFeature: Record<string, number>;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Get the current subscription for a user
 */
export async function getCurrentSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      plan: true,
    },
  });

  return subscription;
}

/**
 * Get all available pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const plans = await prisma.pricingPlan.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      price: 'asc',
    },
  });

  return plans;
}

/**
 * Update subscription to a new plan
 */
export async function updateSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<SubscriptionWithPlan> {
  // Get the current subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Get the new plan
  const newPlan = await prisma.pricingPlan.findUnique({
    where: { id: newPlanId },
  });

  if (!newPlan) {
    throw new Error('New plan not found');
  }

  // Update the subscription in Stripe
  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: subscription.stripeSubscriptionId,
          price: newPlan.stripePriceId,
          proration_behavior: 'always_invoice',
        },
      ],
    });
  }

  // Update the subscription in the database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: newPlanId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
    include: {
      plan: true,
    },
  });

  return updatedSubscription;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<SubscriptionWithPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Cancel the subscription in Stripe
  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // Update the subscription in the database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtPeriodEnd: true,
    },
    include: {
      plan: true,
    },
  });

  return updatedSubscription;
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<SubscriptionWithPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Resume the subscription in Stripe
  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
  }

  // Update the subscription in the database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtPeriodEnd: false,
    },
    include: {
      plan: true,
    },
  });

  return updatedSubscription;
}

/**
 * Get subscription usage and billing information
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      usageRecords: {
        include: {
          feature: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Get the current period's usage
  const currentPeriodStart = subscription.currentPeriodStart || new Date();
  const currentPeriodEnd = subscription.currentPeriodEnd || new Date();

  const usage = subscription.usageRecords.filter(
    (record) =>
      record.recordedAt >= currentPeriodStart && record.recordedAt <= currentPeriodEnd
  );

  // Calculate total usage by feature
  const usageByFeature = usage.reduce((acc, record) => {
    if (!acc[record.feature.name]) {
      acc[record.feature.name] = 0;
    }
    acc[record.feature.name] += record.quantity;
    return acc;
  }, {} as Record<string, number>);

  return {
    subscription,
    usage,
    usageByFeature,
    currentPeriodStart,
    currentPeriodEnd,
  };
} 