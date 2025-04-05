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

// Webhook handler for Stripe events
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get("stripe-signature") as string;

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    // Log signature verification failures
    console.error(`Webhook signature verification failed: ${err.message}`);

    await createEvent({
      eventType: "WEBHOOK_SIGNATURE_FAILED",
      resourceType: "STRIPE_WEBHOOK",
      resourceId: "unknown",
      severity: EventSeverity.ERROR,
      metadata: {
        error: err.message,
        signature: signature?.substring(0, 10) + "..." // Only log part of the signature for security
      },
    });

    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Check for idempotency - if we've processed this event before, return success
  try {
    const processedEvent = await prisma.processedWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (processedEvent) {
      console.log(`Event ${event.id} already processed at ${processedEvent.processedAt}, skipping`);

      await createEvent({
        eventType: "WEBHOOK_DUPLICATE",
        resourceType: "STRIPE_WEBHOOK",
        resourceId: event.id,
        metadata: {
          eventType: event.type,
          firstProcessedAt: processedEvent.processedAt,
        },
      });

      return NextResponse.json({ received: true, status: "duplicate" });
    }
  } catch (error: any) {
    // If we can't check for idempotency, log it but continue processing
    // This avoids dropping webhook events when the database check fails
    console.error(`Error checking webhook idempotency: ${error.message}`);

    await createEvent({
      eventType: "WEBHOOK_IDEMPOTENCY_ERROR",
      resourceType: "STRIPE_WEBHOOK",
      resourceId: event.id,
      severity: EventSeverity.WARNING,
      metadata: {
        eventType: event.type,
        error: error.message,
        stack: error.stack,
      },
    });
  }

  try {
    // Log the incoming webhook
    await createEvent({
      eventType: "WEBHOOK_RECEIVED",
      resourceType: "STRIPE_WEBHOOK",
      resourceId: event.id,
      metadata: {
        eventType: event.type,
        eventCreatedAt: new Date(event.created * 1000),
      },
    });

    // Handle the event based on its type
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string },
          include: { organization: true }
        });

        if (!subscription) {
          console.error('Subscription not found for invoice:', invoice.id);
          return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        // Initialize retry service for this failed payment
        const retryService = new PaymentRetryService();
        await retryService.scheduleRetry({
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          failureCode: invoice.last_payment_error?.code || 'unknown',
          paymentMethodId: invoice.default_payment_method as string
        });

        break;
      }

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.updated":
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case "payment_method.attached":
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case "payment_method.detached":
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "customer.balance_transaction.created":
        await handleCustomerBalanceTransactionCreated(event.data.object as Stripe.CustomerBalanceTransaction);
        break;

      case "refund.created":
        await handleRefundCreated(event.data.object as Stripe.Refund);
        break;

      case "payment_intent.payment_failed": {
        await handlePaymentFailed(event.data.object);
        break;
      }

      case "payment_intent.succeeded": {
        await handlePaymentSucceeded(event.data.object);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        await createEvent({
          eventType: "WEBHOOK_UNHANDLED",
          resourceType: "STRIPE_WEBHOOK",
          resourceId: event.id,
          severity: EventSeverity.WARNING,
          metadata: {
            eventType: event.type,
            message: "No handler implemented for this event type",
          },
        });
    }

    // Record that we've processed this event to prevent duplicates
    await prisma.processedWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
      },
    });

    // Log successful processing
    await createEvent({
      eventType: "WEBHOOK_PROCESSED",
      resourceType: "STRIPE_WEBHOOK",
      resourceId: event.id,
      metadata: {
        eventType: event.type,
        processedAt: new Date(),
      },
    });

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true, status: "processed" });
  } catch (error: any) {
    console.error(`Error processing webhook event: ${error.message}`);

    // Determine error severity based on error type
    const errorSeverity =
      error.message.includes("duplicate key") ? EventSeverity.INFO :
      error.message.includes("not found") ? EventSeverity.WARNING :
      EventSeverity.ERROR;

    // Log the error with appropriate severity
    await createEvent({
      eventType: "WEBHOOK_ERROR",
      resourceType: "STRIPE_WEBHOOK",
      resourceId: event.id,
      severity: errorSeverity,
      metadata: {
        eventType: event.type,
        error: error.message,
        stack: error.stack,
      },
    });

    // Determine if this is a data error (which shouldn't trigger retries)
    // or a system error (which should retry)
    const isDataError =
      error.message.includes("not found") ||
      error.message.includes("already exists") ||
      error.message.includes("duplicate key");

    if (isDataError) {
      // For data errors, still record we processed the event to prevent retries,
      // and return 200 so Stripe doesn't retry
      try {
        await prisma.processedWebhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            processedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error("Failed to mark webhook as processed:", dbError);
      }

      return NextResponse.json(
        { error: "Data error, but acknowledging receipt" },
        { status: 200 }
      );
    } else {
      // For system errors, return 500 so Stripe will retry
      return NextResponse.json(
        { error: "Error processing webhook event" },
        { status: 500 }
      );
    }
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