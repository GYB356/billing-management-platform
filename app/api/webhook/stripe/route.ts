import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createEvent, EventSeverity } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { NotificationChannel } from "@/lib/notifications";
import { handleRefundCreated, handleCustomerBalanceTransactionCreated } from "./handlers/credit";
import { handlePaymentFailed, handlePaymentSucceeded } from "./handlers/payment";
import { handleInvoicePaymentSucceeded } from "./handlers/invoice";
import { StripeCryptoService } from "@/app/billing/features/crypto/stripe-crypto-service";
import { defaultCryptoConfig } from "@/app/billing/features/crypto/config";

const cryptoService = new StripeCryptoService(defaultCryptoConfig);

// Webhook handler for Stripe events
export async function POST(req: NextRequest) {
  try {
  const body = await req.text();
    const signature = headers().get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        
        // Handle crypto payments
        if (paymentIntent.metadata.paymentType === "crypto") {
          await cryptoService.handleSuccessfulPayment(paymentIntent);
        }
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        
        // Handle failed crypto payments
        if (failedPayment.metadata.paymentType === "crypto") {
          await cryptoService.handleFailedPayment(failedPayment);
        }
        break;

      // Add other event types as needed
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error handling Stripe webhook:", error);
      return NextResponse.json(
      { error: error.message || "Webhook handler failed" },
      { status: error.status || 500 }
    );
  }
}

// Handle subscription created event
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // Find the organization by Stripe customer ID
  const customer = subscription.customer as string;
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: customer },
  });

  if (!organization) {
    console.error(`Organization not found for customer ID: ${customer}`);
    return;
  }

  // Find the pricing plan by Stripe price ID
  const stripePrice = subscription.items.data[0].price.id;
  const plan = await prisma.pricingPlan.findFirst({
    where: { stripeId: stripePrice },
  });

  if (!plan) {
    console.error(`Plan not found for price ID: ${stripePrice}`);
    return;
  }

  // Create the subscription in the database
  const newSubscription = await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      status: mapStripeStatusToPrisma(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeId: subscription.id,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      metadata: subscription.metadata,
    },
  });

  // Create an event
  await createEvent({
    organizationId: organization.id,
    eventType: "SUBSCRIPTION_CREATED",
    resourceType: "SUBSCRIPTION",
    resourceId: newSubscription.id,
    metadata: {
      stripeSubscriptionId: subscription.id,
      planId: plan.id,
      planName: plan.name,
    },
  });

  // Create a notification
  await createNotification({
    organizationId: organization.id,
    title: "Subscription Created",
    message: `Your subscription to ${plan.name} has been activated.`,
    type: "SUCCESS",
    data: {
      subscriptionId: newSubscription.id,
      planId: plan.id,
      planName: plan.name,
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

// Handle subscription updated event
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Find the subscription by Stripe ID
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeId: subscription.id },
    include: {
      plan: true,
    },
  });

  if (!existingSubscription) {
    console.error(`Subscription not found for ID: ${subscription.id}`);
    return;
  }

  // Check for a plan change
  let planChanged = false;
  let newPlan = existingSubscription.plan;

  const stripePrice = subscription.items.data[0].price.id;
  if (stripePrice && existingSubscription.plan.stripeId !== stripePrice) {
    // Plan has changed, find the new plan
    newPlan = await prisma.pricingPlan.findFirst({
      where: { stripeId: stripePrice },
    });

    if (newPlan) {
      planChanged = true;
    }
  }

  // Update the subscription in the database
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: mapStripeStatusToPrisma(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      planId: planChanged && newPlan ? newPlan.id : existingSubscription.planId,
      metadata: subscription.metadata,
    },
  });

  // Create an event
  await createEvent({
    organizationId: existingSubscription.organizationId,
    eventType: planChanged ? "SUBSCRIPTION_PLAN_CHANGED" : "SUBSCRIPTION_UPDATED",
    resourceType: "SUBSCRIPTION",
    resourceId: existingSubscription.id,
    metadata: {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      planChanged,
      oldPlanId: existingSubscription.planId,
      newPlanId: planChanged && newPlan ? newPlan.id : existingSubscription.planId,
    },
  });

  // Create a notification if significant changes occurred
  if (planChanged && newPlan) {
    await createNotification({
      organizationId: existingSubscription.organizationId,
      title: "Subscription Plan Changed",
      message: `Your subscription has been updated to ${newPlan.name}.`,
      type: "INFO",
      data: {
        subscriptionId: existingSubscription.id,
        oldPlanId: existingSubscription.planId,
        oldPlanName: existingSubscription.plan.name,
        newPlanId: newPlan.id,
        newPlanName: newPlan.name,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
  } else if (subscription.cancel_at_period_end && !existingSubscription.cancelAtPeriodEnd) {
    await createNotification({
      organizationId: existingSubscription.organizationId,
      title: "Subscription Scheduled to Cancel",
      message: `Your subscription will be canceled at the end of the current billing period (${new Date(subscription.current_period_end * 1000).toLocaleDateString()}).`,
      type: "WARNING",
      data: {
        subscriptionId: existingSubscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
  } else if (subscription.status === "past_due" && existingSubscription.status !== "PAST_DUE") {
    await createNotification({
      organizationId: existingSubscription.organizationId,
      title: "Payment Past Due",
      message: "Your subscription payment is past due. Please update your payment method to avoid service interruption.",
      type: "ERROR",
      data: {
        subscriptionId: existingSubscription.id,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
  }
}

// Handle subscription deleted event
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Find the subscription by Stripe ID
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeId: subscription.id },
    include: {
      plan: true,
    },
  });

  if (!existingSubscription) {
    console.error(`Subscription not found for ID: ${subscription.id}`);
    return;
  }

  // Update the subscription status in the database
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });

  // Create an event
  await createEvent({
    organizationId: existingSubscription.organizationId,
    eventType: "SUBSCRIPTION_CANCELED",
    resourceType: "SUBSCRIPTION",
    resourceId: existingSubscription.id,
    metadata: {
      stripeSubscriptionId: subscription.id,
      planName: existingSubscription.plan.name,
    },
  });

  // Create a notification
  await createNotification({
    organizationId: existingSubscription.organizationId,
    title: "Subscription Canceled",
    message: `Your subscription to ${existingSubscription.plan.name} has been canceled.`,
    type: "INFO",
    data: {
      subscriptionId: existingSubscription.id,
      planId: existingSubscription.planId,
      planName: existingSubscription.plan.name,
      canceledAt: new Date(),
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

// Map Stripe subscription status to Prisma enum
function mapStripeStatusToPrisma(status: string): string {
  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    trialing: "TRIALING",
    unpaid: "UNPAID",
  };

  return statusMap[status] || "ACTIVE";
}