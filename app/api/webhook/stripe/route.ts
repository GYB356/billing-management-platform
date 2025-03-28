import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createEvent, EventSeverity } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { NotificationChannel } from "@/lib/notifications";

// Webhook handler for Stripe events
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get("stripe-signature") as string;
  
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
        
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
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

// Handle invoice payment succeeded event
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  if (!invoice.subscription) {
    return;
  }

  // Find the subscription by Stripe ID
  const subscription = await prisma.subscription.findFirst({
    where: { stripeId: invoice.subscription as string },
    include: {
      organization: true,
      plan: true,
    },
  });

  if (!subscription) {
    console.error(`Subscription not found for ID: ${invoice.subscription}`);
    return;
  }

  // Find or create the invoice in our database
  let existingInvoice = await prisma.invoice.findFirst({
    where: { stripeId: invoice.id },
  });

  if (!existingInvoice) {
    existingInvoice = await prisma.invoice.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        number: invoice.number!,
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: "PAID",
        dueDate: new Date(invoice.due_date! * 1000),
        paidDate: new Date(),
        stripeId: invoice.id,
        pdf: invoice.invoice_pdf,
      },
    });
  } else {
    await prisma.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        status: "PAID",
        paidDate: new Date(),
      },
    });
  }

  // Create a transaction for the payment
  if (invoice.charge) {
    await prisma.transaction.create({
      data: {
        invoiceId: existingInvoice.id,
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: "SUCCEEDED",
        paymentMethod: getPaymentMethodType(invoice),
        stripeId: invoice.charge as string,
      },
    });
  }

  // Create an event
  await createEvent({
    organizationId: subscription.organizationId,
    eventType: "INVOICE_PAID",
    resourceType: "INVOICE",
    resourceId: existingInvoice.id,
    metadata: {
      stripeInvoiceId: invoice.id,
      subscriptionId: subscription.id,
      amount: invoice.total,
      planName: subscription.plan.name,
    },
  });
  
  // Create a notification
  await createNotification({
    organizationId: subscription.organizationId,
    title: "Payment Successful",
    message: `Your payment of ${formatCurrency(invoice.total, invoice.currency)} for the ${subscription.plan.name} subscription was successful.`,
    type: "SUCCESS",
    data: {
      invoiceId: existingInvoice.id,
      subscriptionId: subscription.id,
      amount: invoice.total,
      currency: invoice.currency,
    },
    channels: [NotificationChannel.IN_APP], // Don't send email for successful payments to reduce noise
  });
}

// Handle invoice payment failed event
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  if (!invoice.subscription) {
    return;
  }

  // Find the subscription by Stripe ID
  const subscription = await prisma.subscription.findFirst({
    where: { stripeId: invoice.subscription as string },
    include: {
      organization: true,
      plan: true,
    },
  });

  if (!subscription) {
    console.error(`Subscription not found for ID: ${invoice.subscription}`);
    return;
  }

  // Find or create the invoice in our database
  let existingInvoice = await prisma.invoice.findFirst({
    where: { stripeId: invoice.id },
  });

  if (!existingInvoice) {
    existingInvoice = await prisma.invoice.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        number: invoice.number!,
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: "OPEN",
        dueDate: new Date(invoice.due_date! * 1000),
        stripeId: invoice.id,
        pdf: invoice.invoice_pdf,
      },
    });
  }

  // Create a failed transaction for the payment attempt
  if (invoice.charge) {
    await prisma.transaction.create({
      data: {
        invoiceId: existingInvoice.id,
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: "FAILED",
        paymentMethod: getPaymentMethodType(invoice),
        stripeId: invoice.charge as string,
      },
    });
  }

  // Create an event
  await createEvent({
    organizationId: subscription.organizationId,
    eventType: "INVOICE_PAYMENT_FAILED",
    resourceType: "INVOICE",
    resourceId: existingInvoice.id,
    metadata: {
      stripeInvoiceId: invoice.id,
      subscriptionId: subscription.id,
      amount: invoice.total,
      planName: subscription.plan.name,
      failureMessage: invoice.last_payment_error?.message,
    },
  });
  
  // Create a notification
  await createNotification({
    organizationId: subscription.organizationId,
    title: "Payment Failed",
    message: `Your payment of ${formatCurrency(invoice.total, invoice.currency)} for the ${subscription.plan.name} subscription failed. Please update your payment method.`,
    type: "ERROR",
    data: {
      invoiceId: existingInvoice.id,
      subscriptionId: subscription.id,
      amount: invoice.total,
      currency: invoice.currency,
      failureMessage: invoice.last_payment_error?.message,
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

// Handle checkout session completed event
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Only process subscription checkouts
  if (session.mode !== "subscription") {
    return;
  }

  // The subscription will be handled by the subscription.created webhook
  // Here we can create a customer or organization if needed
  if (session.customer && session.client_reference_id) {
    const organizationId = session.client_reference_id;
    
    // Update the organization with the Stripe customer ID
    await prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: session.customer as string },
    });
    
    // Create an event
    await createEvent({
      organizationId,
      eventType: "CHECKOUT_COMPLETED",
      resourceType: "ORGANIZATION",
      resourceId: organizationId,
      metadata: {
        stripeCustomerId: session.customer as string,
        checkoutSessionId: session.id,
      },
    });
  }
}

// Handle customer updated event
async function handleCustomerUpdated(customer: Stripe.Customer) {
  // Find the organization by Stripe customer ID
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: customer.id },
  });

  if (!organization) {
    // Also check if there's a user with this customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customer.id },
    });
    
    if (!user) {
      console.error(`No organization or user found for customer ID: ${customer.id}`);
      return;
    }
    
    // Update user metadata with customer information
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: {
          ...user.metadata,
          stripeCustomer: {
            email: customer.email,
            name: customer.name,
            phone: customer.phone,
            updatedAt: new Date(),
          },
        },
      },
    });
    
    // Create an event
    await createEvent({
      userId: user.id,
      eventType: "CUSTOMER_UPDATED",
      resourceType: "USER",
      resourceId: user.id,
      metadata: {
        stripeCustomerId: customer.id,
        email: customer.email,
        name: customer.name,
      },
    });
    
    return;
  }
  
  // Update the organization with the latest customer information
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      email: customer.email || organization.email,
      settings: {
        ...organization.settings,
        billingEmail: customer.email,
        billingName: customer.name,
        billingPhone: customer.phone,
        updatedAt: new Date(),
      },
    },
  });
  
  // Create an event
  await createEvent({
    organizationId: organization.id,
    eventType: "CUSTOMER_UPDATED",
    resourceType: "ORGANIZATION",
    resourceId: organization.id,
    metadata: {
      stripeCustomerId: customer.id,
      email: customer.email,
      name: customer.name,
    },
  });
}

// Handle payment method attached event
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  if (!paymentMethod.customer) {
    console.error("No customer ID attached to payment method");
    return;
  }
  
  const customerId = typeof paymentMethod.customer === 'string' 
    ? paymentMethod.customer 
    : paymentMethod.customer.id;
  
  // Find the organization by Stripe customer ID
  const organization = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!organization) {
    // Also check if there's a user with this customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    
    if (!user) {
      console.error(`No organization or user found for customer ID: ${customerId}`);
      return;
    }
    
    // Update user metadata with payment method information
    const existingMethods = (user.metadata?.paymentMethods || []) as any[];
    const paymentMethods = [
      ...existingMethods.filter((pm: any) => pm.id !== paymentMethod.id),
      {
        id: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        expMonth: paymentMethod.card?.exp_month,
        expYear: paymentMethod.card?.exp_year,
        isDefault: false,
        addedAt: new Date(),
      }
    ];
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: {
          ...user.metadata,
          paymentMethods,
        },
      },
    });
    
    // Create an event
    await createEvent({
      userId: user.id,
      eventType: "PAYMENT_METHOD_ADDED",
      resourceType: "USER",
      resourceId: user.id,
      metadata: {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
      },
    });
    
    // Create a notification
    await createNotification({
      userId: user.id,
      title: "Payment Method Added",
      message: `A new payment method (${paymentMethod.card?.brand} ending in ${paymentMethod.card?.last4}) has been added to your account.`,
      type: "INFO",
      data: {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
      },
    });
    
    return;
  }
  
  // Update organization settings with payment method information
  const existingMethods = (organization.settings?.paymentMethods || []) as any[];
  const paymentMethods = [
    ...existingMethods.filter((pm: any) => pm.id !== paymentMethod.id),
    {
      id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
      isDefault: false,
      addedAt: new Date(),
    }
  ];
  
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      settings: {
        ...organization.settings,
        paymentMethods,
      },
    },
  });
  
  // Create an event
  await createEvent({
    organizationId: organization.id,
    eventType: "PAYMENT_METHOD_ADDED",
    resourceType: "ORGANIZATION",
    resourceId: organization.id,
    metadata: {
      paymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
    },
  });
  
  // Create a notification
  await createNotification({
    organizationId: organization.id,
    title: "Payment Method Added",
    message: `A new payment method (${paymentMethod.card?.brand} ending in ${paymentMethod.card?.last4}) has been added to your organization.`,
    type: "INFO",
    data: {
      paymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
    },
  });
}

// Handle payment method detached event
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  // Since the payment method is detached, we need to find who it belonged to
  // based on our records, not from the Stripe event
  
  // Check organizations first
  const organizations = await prisma.organization.findMany({
    where: {
      settings: {
        path: ["paymentMethods"],
        array_contains: [{ id: paymentMethod.id }],
      },
    },
  });
  
  if (organizations.length > 0) {
    // Update each organization's payment methods
    for (const organization of organizations) {
      const existingMethods = (organization.settings?.paymentMethods || []) as any[];
      const paymentMethods = existingMethods.filter((pm: any) => pm.id !== paymentMethod.id);
      
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          settings: {
            ...organization.settings,
            paymentMethods,
          },
        },
      });
      
      // Create an event
      await createEvent({
        organizationId: organization.id,
        eventType: "PAYMENT_METHOD_REMOVED",
        resourceType: "ORGANIZATION",
        resourceId: organization.id,
        metadata: {
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
        },
      });
      
      // Create a notification
      await createNotification({
        organizationId: organization.id,
        title: "Payment Method Removed",
        message: `A payment method (${paymentMethod.card?.brand} ending in ${paymentMethod.card?.last4}) has been removed from your organization.`,
        type: "INFO",
        data: {
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
        },
      });
    }
    
    return;
  }
  
  // Check users next
  const users = await prisma.user.findMany({
    where: {
      metadata: {
        path: ["paymentMethods"],
        array_contains: [{ id: paymentMethod.id }],
      },
    },
  });
  
  if (users.length > 0) {
    // Update each user's payment methods
    for (const user of users) {
      const existingMethods = (user.metadata?.paymentMethods || []) as any[];
      const paymentMethods = existingMethods.filter((pm: any) => pm.id !== paymentMethod.id);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          metadata: {
            ...user.metadata,
            paymentMethods,
          },
        },
      });
      
      // Create an event
      await createEvent({
        userId: user.id,
        eventType: "PAYMENT_METHOD_REMOVED",
        resourceType: "USER",
        resourceId: user.id,
        metadata: {
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
        },
      });
      
      // Create a notification
      await createNotification({
        userId: user.id,
        title: "Payment Method Removed",
        message: `A payment method (${paymentMethod.card?.brand} ending in ${paymentMethod.card?.last4}) has been removed from your account.`,
        type: "INFO",
        data: {
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
        },
      });
    }
  }
}

// Handle charge refunded event
async function handleChargeRefunded(charge: Stripe.Charge) {
  // Find the transaction by Stripe charge ID
  const transaction = await prisma.transaction.findFirst({
    where: { stripeId: charge.id },
    include: {
      invoice: {
        include: {
          subscription: {
            include: {
              organization: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    console.error(`Transaction not found for charge ID: ${charge.id}`);
    return;
  }

  // Update the transaction status
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "REFUNDED",
    },
  });

  // If the invoice has a subscription, create an event and notification
  if (transaction.invoice?.subscription) {
    const subscription = transaction.invoice.subscription;
    const organization = subscription.organization;
    
    // Create an event
    await createEvent({
      organizationId: organization.id,
      eventType: "PAYMENT_REFUNDED",
      resourceType: "TRANSACTION",
      resourceId: transaction.id,
      metadata: {
        chargeId: charge.id,
        amount: charge.amount,
        invoiceId: transaction.invoice.id,
        subscriptionId: subscription.id,
      },
    });
    
    // Create a notification
    await createNotification({
      organizationId: organization.id,
      title: "Payment Refunded",
      message: `A payment of ${formatCurrency(charge.amount, charge.currency)} has been refunded.`,
      type: "INFO",
      data: {
        chargeId: charge.id,
        amount: charge.amount,
        invoiceId: transaction.invoice.id,
        transactionId: transaction.id,
      },
      channels: ["IN_APP", "EMAIL"],
    });
  }
  
  // If the refund was partial, create a new transaction for the refund
  if (charge.amount_refunded < charge.amount) {
    await prisma.transaction.create({
      data: {
        invoiceId: transaction.invoice.id,
        amount: -charge.amount_refunded, // Negative amount for refund
        currency: charge.currency,
        status: "REFUNDED",
        paymentMethod: transaction.paymentMethod,
        stripeId: charge.refunds?.data[0]?.id,
      },
    });
  }
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

// Get payment method type from invoice
function getPaymentMethodType(invoice: Stripe.Invoice): string {
  if (invoice.payment_intent && typeof invoice.payment_intent === "object") {
    if (invoice.payment_intent.payment_method && 
        typeof invoice.payment_intent.payment_method === "object") {
      return invoice.payment_intent.payment_method.type;
    }
  }
  return "unknown";
}

// Format currency for display
function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toLowerCase(),
    minimumFractionDigits: 2,
  });
  
  return formatter.format(amount / 100);
} 