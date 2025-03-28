import { prisma } from "./prisma";
import { Subscription, PricingPlan, SubscriptionStatus } from "@prisma/client";
import { stripe } from "./stripe";

/**
 * Create a trial subscription
 */
export async function createTrialSubscription({
  organizationId,
  planId,
  trialDays,
}: {
  organizationId: string;
  planId: string;
  trialDays?: number;
}): Promise<Subscription> {
  // Get the organization
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscriptions: {
        where: {
          status: {
            in: ["ACTIVE", "TRIALING"],
          },
        },
      },
    },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${organizationId} not found`);
  }

  // Check if there's already an active subscription
  if (organization.subscriptions.length > 0) {
    throw new Error("Organization already has an active subscription");
  }

  // Get the pricing plan
  const plan = await prisma.pricingPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Pricing plan with ID ${planId} not found`);
  }

  // Use plan trial days if not specified
  const trialPeriodDays = trialDays ?? plan.trialDays;
  
  if (trialPeriodDays <= 0) {
    throw new Error("Trial days must be greater than 0");
  }

  // Calculate trial period
  const now = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(now.getDate() + trialPeriodDays);

  // Create Stripe subscription with trial
  let stripeSubscription;
  
  try {
    // Ensure the customer exists in Stripe
    if (!organization.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: organization.name,
        email: organization.email || undefined,
        metadata: {
          organizationId: organization.id,
        },
      });

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          stripeCustomerId: customer.id,
        },
      });
    }

    // Create subscription with trial
    stripeSubscription = await stripe.subscriptions.create({
      customer: organization.stripeCustomerId!,
      items: [
        {
          price: plan.stripeId!,
        },
      ],
      trial_end: Math.floor(trialEnd.getTime() / 1000),
      metadata: {
        organizationId,
        planId,
      },
    });
  } catch (error) {
    console.error("Error creating Stripe trial subscription:", error);
    throw new Error(`Failed to create trial subscription in Stripe: ${(error as Error).message}`);
  }

  // Create subscription in our database
  const subscription = await prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status: "TRIALING" as SubscriptionStatus,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd: trialEnd,
      stripeId: stripeSubscription.id,
    },
  });

  return subscription;
}

/**
 * Check trial status and set up reminders
 */
export async function processTrialReminders(): Promise<void> {
  // Get all active trials
  const trialSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEnd: {
        gte: new Date(), // Trial hasn't ended yet
      },
    },
    include: {
      organization: true,
      plan: true,
    },
  });

  console.log(`Processing reminders for ${trialSubscriptions.length} active trials`);

  // Process each trial
  for (const subscription of trialSubscriptions) {
    // Calculate days until trial ends
    const now = new Date();
    const daysRemaining = Math.ceil(
      (subscription.trialEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get the plan's reminder days, defaulting to [1, 3, 7]
    const reminderDays = (subscription.plan.trialReminders as any)?.days || [1, 3, 7];

    // Check if we should send a reminder today
    if (reminderDays.includes(daysRemaining)) {
      console.log(`Sending reminder for subscription ${subscription.id} (${daysRemaining} days remaining)`);
      
      // In a real implementation, this would send an email or notification
      // For now, we'll just log it
      console.log(`Trial for ${subscription.organization.name} will end in ${daysRemaining} days`);
    }
  }
}

/**
 * Process expired trials
 */
export async function processExpiredTrials(): Promise<void> {
  const now = new Date();
  
  // Find all expired trials that haven't been processed yet
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEnd: {
        lt: now, // Trial has ended
      },
      trialConvertedAt: null, // Not yet converted
    },
    include: {
      organization: true,
      plan: true,
    },
  });

  console.log(`Processing ${expiredTrials.length} expired trials`);

  // Process each expired trial
  for (const subscription of expiredTrials) {
    try {
      console.log(`Processing expired trial for subscription ${subscription.id}`);
      
      // Check if the customer has a default payment method
      const hasPaymentMethod = await checkOrganizationHasPaymentMethod(subscription.organizationId);
      
      // Update subscription status
      let newStatus: SubscriptionStatus;
      
      if (hasPaymentMethod) {
        newStatus = "ACTIVE";
        console.log(`Converting trial to active subscription for ${subscription.organization.name}`);
      } else {
        newStatus = "INCOMPLETE";
        console.log(`Trial expired without payment method for ${subscription.organization.name}`);
      }
      
      // Update subscription in database
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: newStatus,
          trialConvertedAt: now,
        },
      });
      
      // Update in Stripe
      if (subscription.stripeId) {
        if (newStatus === "ACTIVE") {
          // Remove trial end to convert to regular subscription
          await stripe.subscriptions.update(subscription.stripeId, {
            trial_end: "now",
            proration_behavior: "none",
          });
        } else {
          // Cancel the subscription if no payment method
          await stripe.subscriptions.update(subscription.stripeId, {
            cancel_at_period_end: true,
          });
        }
      }
    } catch (error) {
      console.error(`Error processing expired trial ${subscription.id}:`, error);
    }
  }
}

/**
 * Check if an organization has a default payment method
 */
async function checkOrganizationHasPaymentMethod(organizationId: string): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization?.stripeCustomerId) {
    return false;
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: organization.stripeCustomerId,
      type: "card",
    });

    return paymentMethods.data.length > 0;
  } catch (error) {
    console.error("Error checking payment methods:", error);
    return false;
  }
} 