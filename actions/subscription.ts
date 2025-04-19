 'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  stripe, 
  getOrCreateCustomer, 
  createCheckoutSession, 
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  getFormattedProductPrices
} from '@/lib/stripe';
import { env } from '@/lib/env';
import { z } from 'zod';

// Schema for subscription creation
const subscribeSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  trialDays: z.number().min(0).max(30).optional(),
});

/**
 * Create a checkout session for a subscription
 */
export async function createSubscription(
  data: z.infer<typeof subscribeSchema>
) {
  try {
    // Validate input
    const { priceId, successUrl, cancelUrl, trialDays } = subscribeSchema.parse(data);
    
    // Get current user
    const session = await auth();
    
    if (!session?.user?.email) {
      return { error: 'You must be logged in to subscribe' };
    }
    
    // Get or create a Stripe customer
    const customerId = await getOrCreateCustomer({
      email: session.user.email,
      name: session.user.name || undefined,
      metadata: {
        userId: session.user.id,
      },
    });
    
    // Update user record with Stripe customer ID
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
    
    // Create checkout session
    const checkoutUrl = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: successUrl || `${env.APP_URL}/dashboard?success=true`,
      cancelUrl: cancelUrl || `${env.APP_URL}/pricing?canceled=true`,
      trialDays,
    });
    
    return { url: checkoutUrl };
  } catch (error) {
    logger.error('Failed to create subscription', { error });
    return { error: 'Failed to create subscription' };
  }
}

/**
 * Redirect to Stripe billing portal
 */
export async function redirectToBillingPortal() {
  try {
    // Get current user
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: 'You must be logged in to access billing' };
    }
    
    // Get user's Stripe customer ID
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });
    
    if (!user?.stripeCustomerId) {
      return { error: 'No billing account found' };
    }
    
    // Create billing portal session
    const url = await createBillingPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${env.APP_URL}/dashboard`,
    });
    
    redirect(url);
  } catch (error) {
    logger.error('Failed to redirect to billing portal', { error });
    return { error: 'Failed to access billing portal' };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelUserSubscription({
  subscriptionId,
  atPeriodEnd = true,
}: {
  subscriptionId: string;
  atPeriodEnd?: boolean;
}) {
  try {
    // Get current user
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: 'You must be logged in to cancel a subscription' };
    }
    
    // Verify user owns this subscription
    const subscription = await db.subscription.findFirst({
      where: {
        providerId: subscriptionId,
        userId: session.user.id,
      },
    });
    
    if (!subscription) {
      return { error: 'Subscription not found' };
    }
    
    // Cancel subscription with Stripe
    await cancelSubscription({
      subscriptionId,
      atPeriodEnd,
    });
    
    // Update subscription in database if cancelling immediately
    if (!atPeriodEnd) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });
    } else {
      // Otherwise just mark it as scheduled for cancellation
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAt: subscription.currentPeriodEnd,
        },
      });
    }
    
    // Log event
    await db.subscriptionEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        type: atPeriodEnd ? 'scheduled_cancellation' : 'canceled',
        data: { atPeriodEnd },
      },
    });
    
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to cancel subscription', { error });
    return { error: 'Failed to cancel subscription' };
  }
}

/**
 * Resume a subscription
 */
export async function resumeUserSubscription(subscriptionId: string) {
  try {
    // Get current user
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: 'You must be logged in to resume a subscription' };
    }
    
    // Verify user owns this subscription
    const subscription = await db.subscription.findFirst({
      where: {
        providerId: subscriptionId,
        userId: session.user.id,
      },
    });
    
    if (!subscription) {
      return { error: 'Subscription not found' };
    }
    
    // Resume subscription with Stripe
    await resumeSubscription(subscriptionId);
    
    // Update subscription in database
    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: null,
      },
    });
    
    // Log event
    await db.subscriptionEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        type: 'resumed',
      },
    });
    
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to resume subscription', { error });
    return { error: 'Failed to resume subscription' };
  }
}

/**
 * Change subscription plan
 */
export async function changeUserSubscriptionPlan({
  subscriptionId,
  newPriceId,
}: {
  subscriptionId: string;
  newPriceId: string;
}) {
  try {
    // Get current user
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: 'You must be logged in to change your subscription' };
    }
    
    // Verify user owns this subscription
    const subscription = await db.subscription.findFirst({
      where: {
        providerId: subscriptionId,
        userId: session.user.id,
      },
    });
    
    if (!subscription) {
      return { error: 'Subscription not found' };
    }
    
    // Change plan with Stripe
    await changeSubscriptionPlan({
      subscriptionId,
      newPriceId,
    });
    
    // Log event
    await db.subscriptionEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        type: 'plan_changed',
        data: { newPriceId },
      },
    });
    
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to change subscription plan', { error });
    return { error: 'Failed to change subscription plan' };
  }
}

/**
 * Get all pricing plans
 */
export async function getPricingPlans() {
  try {
    return await getFormattedProductPrices();
  } catch (error) {
    logger.error('Failed to fetch pricing plans', { error });
    return [];
  }
}