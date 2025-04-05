import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { 
  Subscription, 
  PricingPlan, 
  Organization, 
  SubscriptionStatus, 
  PlanFeature 
} from '@prisma/client';
import { sendSubscriptionEmail } from '@/lib/email';
import Stripe from 'stripe';

export interface SubscriptionParams {
  customerId: string;
  organizationId: string;
  planId: string;
  priceId: string;
  quantity?: number;
  trialDays?: number;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
  couponId?: string;
  taxRateIds?: string[];
}

export interface SubscriptionWithDetails extends Subscription {
  plan: PricingPlan;
  organization: Organization;
  planFeatures?: PlanFeature[];
}

/**
 * Creates a new subscription
 */
export async function createSubscription(params: SubscriptionParams): Promise<SubscriptionWithDetails> {
  const { 
    organizationId, 
    planId, 
    customerId, 
    priceId, 
    quantity = 1,
    trialDays,
    paymentMethodId,
    metadata = {},
    couponId,
    taxRateIds = []
  } = params;

  // Retrieve plan details
  const plan = await prisma.pricingPlan.findUnique({
    where: { id: planId },
    include: {
      planFeatures: {
        include: {
          feature: true
        }
      }
    }
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Create subscription in Stripe
  const stripeSubscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [
      {
        price: priceId,
        quantity
      }
    ],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      organizationId,
      planId,
      ...metadata
    }
  };

  // Add trial if specified
  if (trialDays) {
    stripeSubscriptionParams.trial_period_days = trialDays;
  }

  // Add payment method if specified
  if (paymentMethodId) {
    stripeSubscriptionParams.default_payment_method = paymentMethodId;
  }

  // Add coupon if specified
  if (couponId) {
    stripeSubscriptionParams.coupon = couponId;
  }

  // Add tax rates if specified
  if (taxRateIds.length > 0) {
    stripeSubscriptionParams.default_tax_rates = taxRateIds;
  }

  // Create subscription in Stripe
  let stripeSubscription;
  try {
    stripeSubscription = await stripe.subscriptions.create(stripeSubscriptionParams);
  } catch (error) {
    console.error('Error creating subscription in Stripe:', error);
    throw new Error('Failed to create subscription in Stripe');
  }

  // Determine subscription status
  let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
  if (stripeSubscription.status === 'trialing') {
    status = SubscriptionStatus.TRIALING;
  } else if (stripeSubscription.status === 'incomplete') {
    status = SubscriptionStatus.INCOMPLETE;
  }

  // Create subscription in database
  const subscription = await prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status,
      quantity,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEndsAt: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000) 
        : null,
      metadata
    },
    include: {
      plan: true,
      organization: true
    }
  });

  // Send email notification
  try {
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_created',
      {
        planName: subscription.plan.name,
        startDate: subscription.currentPeriodStart,
        endDate: subscription.currentPeriodEnd,
        price: plan.basePrice / 100, // Convert from cents to dollars
        currency: plan.currency
      }
    );
  } catch (error) {
    console.error('Error sending subscription email:', error);
    // Don't throw error if email fails
  }

  return subscription;
}

/**
 * Updates an existing subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  params: {
    planId?: string;
    priceId?: string;
    quantity?: number;
    metadata?: Record<string, any>;
    cancelAtPeriodEnd?: boolean;
    couponId?: string;
    taxRateIds?: string[];
  }
): Promise<SubscriptionWithDetails> {
  const { 
    planId, 
    priceId, 
    quantity, 
    metadata, 
    cancelAtPeriodEnd,
    couponId,
    taxRateIds
  } = params;

  // Retrieve existing subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      organization: true
    }
  });

  if (!existingSubscription) {
    throw new Error('Subscription not found');
  }

  // Update subscription in Stripe if it exists
  if (existingSubscription.stripeSubscriptionId) {
    try {
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      if (priceId) {
        updateParams.items = [
          {
            id: await getStripeSubscriptionItemId(existingSubscription.stripeSubscriptionId),
            price: priceId,
            quantity: quantity || existingSubscription.quantity
          }
        ];
      } else if (quantity) {
        updateParams.items = [
          {
            id: await getStripeSubscriptionItemId(existingSubscription.stripeSubscriptionId),
            quantity
          }
        ];
      }

      if (metadata) {
        updateParams.metadata = {
          ...existingSubscription.metadata as Record<string, any>,
          ...metadata
        };
      }

      if (cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = cancelAtPeriodEnd;
      }

      if (couponId) {
        updateParams.coupon = couponId;
      }

      if (taxRateIds && taxRateIds.length > 0) {
        updateParams.default_tax_rates = taxRateIds;
      }

      const stripeSubscription = await stripe.subscriptions.update(
        existingSubscription.stripeSubscriptionId,
        updateParams
      );

      // Update local status if it changed in Stripe
      if (stripeSubscription.status !== existingSubscription.status.toLowerCase()) {
        let newStatus: SubscriptionStatus;
        switch (stripeSubscription.status) {
          case 'active':
            newStatus = SubscriptionStatus.ACTIVE;
            break;
          case 'trialing':
            newStatus = SubscriptionStatus.TRIALING;
            break;
          case 'past_due':
            newStatus = SubscriptionStatus.PAST_DUE;
            break;
          case 'canceled':
            newStatus = SubscriptionStatus.CANCELED;
            break;
          case 'incomplete':
            newStatus = SubscriptionStatus.INCOMPLETE;
            break;
          case 'incomplete_expired':
            newStatus = SubscriptionStatus.INCOMPLETE_EXPIRED;
            break;
          case 'unpaid':
            newStatus = SubscriptionStatus.UNPAID;
            break;
          default:
            newStatus = existingSubscription.status;
        }

        existingSubscription.status = newStatus;
      }
    } catch (error) {
      console.error('Error updating subscription in Stripe:', error);
      throw new Error('Failed to update subscription in Stripe');
    }
  }

  // Prepare update data
  const updateData: any = {};
  
  if (planId) {
    updateData.planId = planId;
  }
  
  if (quantity) {
    updateData.quantity = quantity;
  }
  
  if (metadata) {
    updateData.metadata = {
      ...existingSubscription.metadata as Record<string, any>,
      ...metadata
    };
  }
  
  if (cancelAtPeriodEnd !== undefined) {
    updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;
    
    if (cancelAtPeriodEnd) {
      updateData.canceledAt = new Date();
    } else {
      updateData.canceledAt = null;
    }
  }

  // Update subscription in database
  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: updateData,
    include: {
      plan: true,
      organization: true
    }
  });

  return subscription;
}

/**
 * Cancels a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelImmediately: boolean = false
): Promise<SubscriptionWithDetails> {
  // Retrieve existing subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      organization: true
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Cancel subscription in Stripe if it exists
  if (subscription.stripeSubscriptionId) {
    try {
      if (cancelImmediately) {
        await stripe.subscriptions.del(subscription.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }
    } catch (error) {
      console.error('Error canceling subscription in Stripe:', error);
      throw new Error('Failed to cancel subscription in Stripe');
    }
  }

  // Update subscription in database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtPeriodEnd: !cancelImmediately,
      canceledAt: new Date(),
      status: cancelImmediately ? SubscriptionStatus.CANCELED : subscription.status,
      endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd
    },
    include: {
      plan: true,
      organization: true
    }
  });

  // Send email notification
  try {
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_canceled',
      {
        planName: subscription.plan.name,
        canceledAt: new Date(),
        endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd
      }
    );
  } catch (error) {
    console.error('Error sending subscription cancellation email:', error);
    // Don't throw error if email fails
  }

  return updatedSubscription;
}

/**
 * Pauses a subscription
 */
export async function pauseSubscription(
  subscriptionId: string,
  pauseDuration: number,
  reason?: string
): Promise<SubscriptionWithDetails> {
  // Validate pause duration
  if (pauseDuration < 1 || pauseDuration > 90) {
    throw new Error('Pause duration must be between 1 and 90 days');
  }

  // Retrieve existing subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      organization: true
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.isPaused) {
    throw new Error('Subscription is already paused');
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIALING) {
    throw new Error('Only active or trialing subscriptions can be paused');
  }

  // Calculate pause dates
  const pausedAt = new Date();
  const resumesAt = new Date(Date.now() + pauseDuration * 24 * 60 * 60 * 1000);

  // Update subscription in Stripe if it exists
  if (subscription.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: {
          behavior: 'void',
          resumes_at: Math.floor(resumesAt.getTime() / 1000),
        },
        metadata: {
          ...subscription.metadata as Record<string, any>,
          isPaused: 'true',
          pausedAt: pausedAt.toISOString(),
          resumesAt: resumesAt.toISOString(),
          pauseReason: reason || 'User requested'
        }
      });
    } catch (error) {
      console.error('Error pausing subscription in Stripe:', error);
      throw new Error('Failed to pause subscription in Stripe');
    }
  }

  // Create pause history record
  await prisma.pauseHistory.create({
    data: {
      subscriptionId,
      pausedAt,
      resumesAt,
      reason
    }
  });

  // Update subscription in database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      isPaused: true,
      pausedAt,
      resumesAt,
      pauseReason: reason,
      status: SubscriptionStatus.PAUSED
    },
    include: {
      plan: true,
      organization: true
    }
  });

  // Send email notification
  try {
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_paused',
      {
        planName: subscription.plan.name,
        pausedAt,
        resumesAt,
        reason: reason || 'Not specified'
      }
    );
  } catch (error) {
    console.error('Error sending subscription pause email:', error);
    // Don't throw error if email fails
  }

  return updatedSubscription;
}

/**
 * Resumes a paused subscription
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<SubscriptionWithDetails> {
  // Retrieve existing subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      organization: true
    }
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (!subscription.isPaused) {
    throw new Error('Subscription is not paused');
  }

  // Resume subscription in Stripe if it exists
  if (subscription.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: '',
        metadata: {
          ...subscription.metadata as Record<string, any>,
          isPaused: 'false',
          resumedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error resuming subscription in Stripe:', error);
      throw new Error('Failed to resume subscription in Stripe');
    }
  }

  // Update pause history record
  const pauseHistory = await prisma.pauseHistory.findFirst({
    where: {
      subscriptionId,
      resumedAt: null
    },
    orderBy: {
      pausedAt: 'desc'
    }
  });

  if (pauseHistory) {
    await prisma.pauseHistory.update({
      where: { id: pauseHistory.id },
      data: {
        resumedAt: new Date()
      }
    });
  }

  // Update subscription in database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      isPaused: false,
      pausedAt: null,
      resumesAt: null,
      pauseReason: null,
      status: SubscriptionStatus.ACTIVE
    },
    include: {
      plan: true,
      organization: true
    }
  });

  // Send email notification
  try {
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_resumed',
      {
        planName: subscription.plan.name,
        resumedAt: new Date()
      }
    );
  } catch (error) {
    console.error('Error sending subscription resume email:', error);
    // Don't throw error if email fails
  }

  return updatedSubscription;
}

/**
 * Gets the Stripe subscription item ID for a subscription
 */
async function getStripeSubscriptionItemId(stripeSubscriptionId: string): Promise<string> {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['items']
  });

  if (!subscription.items.data || subscription.items.data.length === 0) {
    throw new Error('No subscription items found');
  }

  return subscription.items.data[0].id;
}

/**
 * Gets a subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<SubscriptionWithDetails | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      organization: true,
    }
  });

  return subscription;
}

/**
 * Gets all active subscriptions for an organization
 */
export async function getActiveSubscriptionsForOrganization(organizationId: string): Promise<SubscriptionWithDetails[]> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
      }
    },
    include: {
      plan: true,
      organization: true,
    }
  });

  return subscriptions;
} 