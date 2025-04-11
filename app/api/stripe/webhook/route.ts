import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

// Verify Stripe signature
async function verifyStripeSignature(request: Request): Promise<Stripe.Event> {
  const body = await request.text();
  const signature = headers().get('stripe-signature') as string;
  
  if (!signature) {
    throw new Error('Missing Stripe signature');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    return event;
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    throw new Error(`Webhook Error: ${error.message}`);
  }
}

// Check if we've already processed this event
async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const processedEvent = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
  });
  
  return !!processedEvent;
}

// Mark event as processed
async function markEventAsProcessed(eventId: string, eventType: string): Promise<void> {
  await prisma.processedWebhookEvent.create({
    data: {
      eventId,
      eventType,
    },
  });
}

export async function POST(request: Request) {
  try {
    const event = await verifyStripeSignature(request);
    
    // Check if we already processed this event
    if (await hasProcessedEvent(event.id)) {
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // Handle the event based on its type
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark the event as processed
    await markEventAsProcessed(event.id, event.type);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }
}

// Handle subscription created event
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;
  const planId = subscription.metadata.planId;
  
  if (!organizationId || !planId) {
    console.error('Missing required metadata in subscription:', subscription.id);
    return;
  }
  
  // Check if this subscription already exists in our database
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: subscription.id,
    },
  });
  
  if (existingSubscription) {
    console.log('Subscription already exists, skipping creation:', subscription.id);
    return;
  }
  
  // Map Stripe status to our status enum
  let status: SubscriptionStatus;
  switch (subscription.status) {
    case 'active':
      status = SubscriptionStatus.ACTIVE;
      break;
    case 'trialing':
      status = SubscriptionStatus.TRIALING;
      break;
    case 'past_due':
      status = SubscriptionStatus.PAST_DUE;
      break;
    case 'canceled':
      status = SubscriptionStatus.CANCELED;
      break;
    case 'incomplete':
      status = SubscriptionStatus.INCOMPLETE;
      break;
    case 'incomplete_expired':
      status = SubscriptionStatus.INCOMPLETE_EXPIRED;
      break;
    case 'unpaid':
      status = SubscriptionStatus.UNPAID;
      break;
    default:
      status = SubscriptionStatus.ACTIVE;
  }
  
  // Create a new subscription record in our database
  await prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      quantity: subscription.items.data[0].quantity || 1,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
    },
  });
}

// Handle subscription updated event
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Find the subscription in our database
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: subscription.id,
    },
  });
  
  if (!existingSubscription) {
    console.error('Subscription not found for update:', subscription.id);
    return;
  }
  
  // Map Stripe status to our status enum
  let status: SubscriptionStatus;
  switch (subscription.status) {
    case 'active':
      status = SubscriptionStatus.ACTIVE;
      break;
    case 'trialing':
      status = SubscriptionStatus.TRIALING;
      break;
    case 'past_due':
      status = SubscriptionStatus.PAST_DUE;
      break;
    case 'canceled':
      status = SubscriptionStatus.CANCELED;
      break;
    case 'incomplete':
      status = SubscriptionStatus.INCOMPLETE;
      break;
    case 'incomplete_expired':
      status = SubscriptionStatus.INCOMPLETE_EXPIRED;
      break;
    case 'unpaid':
      status = SubscriptionStatus.UNPAID;
      break;
    default:
      status = existingSubscription.status;
  }
  
  // Check if subscription was paused or resumed
  const isPaused = !!subscription.pause_collection;
  
  // Update the subscription in our database
  await prisma.subscription.update({
    where: {
      id: existingSubscription.id,
    },
    data: {
      status,
      quantity: subscription.items.data[0].quantity || existingSubscription.quantity,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      isPaused,
      pausedAt: isPaused ? new Date() : null,
      resumesAt: isPaused && subscription.pause_collection?.resumes_at 
        ? new Date(subscription.pause_collection.resumes_at * 1000) 
        : null,
      canceledAt: subscription.canceled_at 
        ? new Date(subscription.canceled_at * 1000) 
        : null,
      trialEndsAt: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
    },
  });
  
  // Update pause history if status changed
  if (isPaused && !existingSubscription.isPaused) {
    // Create pause history record for new pause
    await prisma.pauseHistory.create({
      data: {
        subscriptionId: existingSubscription.id,
        pausedAt: new Date(),
        resumesAt: subscription.pause_collection?.resumes_at 
          ? new Date(subscription.pause_collection.resumes_at * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days
      },
    });
  } else if (!isPaused && existingSubscription.isPaused) {
    // Update existing pause history record with resume date
    const pauseHistory = await prisma.pauseHistory.findFirst({
      where: {
        subscriptionId: existingSubscription.id,
        resumedAt: null,
      },
      orderBy: {
        pausedAt: 'desc',
      },
    });
    
    if (pauseHistory) {
      await prisma.pauseHistory.update({
        where: {
          id: pauseHistory.id,
        },
        data: {
          resumedAt: new Date(),
        },
      });
    }
  }
}

// Handle subscription deleted event
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Find the subscription in our database
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: subscription.id,
    },
  });
  
  if (!existingSubscription) {
    console.error('Subscription not found for deletion:', subscription.id);
    return;
  }
  
  // Update the subscription status in our database
  await prisma.subscription.update({
    where: {
      id: existingSubscription.id,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      endDate: new Date(),
    },
  });
}

// Handle invoice payment succeeded event
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    // Not a subscription invoice
    return;
  }
  
  // Find the subscription in our database
  const subscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: invoice.subscription as string,
    },
  });
  
  if (!subscription) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }
  
  // Update the last billing date
  await prisma.subscription.update({
    where: {
      id: subscription.id,
    },
    data: {
      lastBillingDate: new Date(),
      nextBillingDate: invoice.next_payment_attempt 
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
    },
  });
  
  // TODO: Create invoice record in our database
}

// Handle invoice payment failed event
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    // Not a subscription invoice
    return;
  }
  
  // Find the subscription in our database
  const subscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: invoice.subscription as string,
    },
  });
  
  if (!subscription) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }
  
  // Update the subscription status if needed
  if (subscription.status === SubscriptionStatus.ACTIVE || 
      subscription.status === SubscriptionStatus.TRIALING) {
    await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: SubscriptionStatus.PAST_DUE,
      },
    });
  }
  
  // TODO: Send notification to customer about failed payment
}

// Handle invoice finalized event
async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    // Not a subscription invoice
    return;
  }
  
  // TODO: Create or update invoice record in our database
} 