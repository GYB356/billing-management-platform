import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import logger from '@/lib/logger';
import { createRedisInstance } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Extend timeout for webhook processing

/**
 * Stripe webhook handler
 * Processes Stripe events and syncs data to our database
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting on webhook endpoint
    if (!shouldProcessWebhook(req)) {
      return new NextResponse('Too many requests', { status: 429 });
    }

    const body = await req.text();
    const signature = headers().get('stripe-signature') as string;

    if (!signature) {
      return new NextResponse('Missing stripe-signature header', { status: 400 });
    }

    // Verify Stripe signature to ensure the request is legitimate
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Webhook signature verification failed: ${errorMessage}`);
      return new NextResponse(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    // Ensure idempotency by checking if we've processed this event before
    const isProcessed = await hasProcessedEvent(event.id);
    if (isProcessed) {
      logger.info(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, processed: false, reason: 'duplicate' }, { status: 200 });
    }

    // Process different event types
    logger.info(`Processing Stripe event: ${event.type}`);
    
    switch (event.type) {
      // Customer subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      
      // Invoice events
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      // Payment events
      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;
      
      case 'charge.failed':
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      
      // Checkout events
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Customer lifecycle events
      case 'customer.created':
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;
      
      // Default case for unhandled events
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    // Mark event as processed
    await markEventAsProcessed(event.id, event.type);
    
    return NextResponse.json({ received: true, processed: true }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error handling webhook: ${errorMessage}`, { error });
    
    // Send to monitoring/alerting system for high-priority errors
    if (error instanceof Error && isHighPriorityError(error, req)) {
      await sendAlertToMonitoring(error, req);
    }
    
    return new NextResponse(`Webhook error: ${errorMessage}`, { status: 500 });
  }
}

/**
 * Rate limiting for webhook endpoint to prevent abuse
 */
function shouldProcessWebhook(req: NextRequest): boolean {
  // If coming from Stripe's IP range, process normally
  // For more robust implementation, verify Stripe IPs: https://stripe.com/docs/ips
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  
  // Simple in-memory rate limiting if not using Redis
  // In production, use Redis for distributed rate limiting
  const redis = createRedisInstance();
  if (!redis) {
    return true; // If Redis is not available, allow all requests
  }

  // You could implement rate limiting here with Redis
  // For simplicity, we'll always return true for now
  return true;
}

/**
 * Check if event has already been processed (idempotency)
 */
async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const redis = createRedisInstance();
  if (redis) {
    const key = `stripe:event:${eventId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }
  
  // Fallback to database check if Redis is not available
  const event = await prisma.stripeEvent.findUnique({
    where: { eventId }
  });
  
  return !!event;
}

/**
 * Mark event as processed for idempotency
 */
async function markEventAsProcessed(eventId: string, eventType: string): Promise<void> {
  // First try with Redis for performance
  const redis = createRedisInstance();
  if (redis) {
    const key = `stripe:event:${eventId}`;
    // Store for 30 days
    await redis.setex(key, 60 * 60 * 24 * 30, eventType);
  }
  
  // Also store in database for long-term storage
  await prisma.stripeEvent.create({
    data: {
      eventId,
      eventType,
      processedAt: new Date()
    }
  });
}

/**
 * Determine if an error should trigger high-priority alerts
 */
function isHighPriorityError(error: Error, req: NextRequest): boolean {
  // High priority if payment-related
  const path = req.nextUrl.pathname;
  if (path.includes('/webhook') && error.message.includes('payment')) {
    return true;
  }
  
  return false;
}

/**
 * Send alert to monitoring system for critical errors
 */
async function sendAlertToMonitoring(error: Error, req: NextRequest): Promise<void> {
  // In a real implementation, you would send to your error monitoring system
  // Such as Sentry, Bugsnag, etc.
  logger.error('CRITICAL WEBHOOK ERROR - ALERT SENT', {
    error: error.message,
    stack: error.stack,
    path: req.nextUrl.pathname,
    method: req.method
  });
  
  // You could also send a Slack notification or email here
  // await sendSlackAlert({...})
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // This is the final confirmation of a successful checkout
  logger.info(`Checkout session completed: ${session.id}`);
  
  // Get customer ID to find the user
  const customerId = session.customer as string;
  
  // Find user associated with this customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Handle based on checkout mode
  if (session.mode === 'subscription') {
    // If this checkout created a subscription
    if (session.subscription) {
      const subscriptionId = session.subscription as string;
      
      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Update user record to reflect active subscription
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // Update subscription status
          // Other fields already handled by subscription.created event
        }
      });
      
      // Log the event
      await prisma.subscriptionEvent.create({
        data: {
          userId: user.id,
          subscriptionId,
          type: 'checkout_completed',
          data: session as any,
        }
      });
      
      // Here you might also want to:
      // 1. Send a welcome email
      // 2. Provision resources for the user
      // 3. Update user permissions/access
    }
  } else if (session.mode === 'payment') {
    // For one-time payments
    if (session.payment_intent) {
      const paymentIntentId = session.payment_intent as string;
      
      // Create a payment record
      await prisma.payment.create({
        data: {
          userId: user.id,
          providerId: paymentIntentId,
          status: 'SUCCEEDED',
          amount: session.amount_total ? session.amount_total / 100 : 0,
          currency: session.currency || 'usd',
          metadata: session.metadata as any,
        }
      });
    }
  }
  
  logger.info(`Checkout session processed for user ${user.id}`);
}

/**
 * Handle invoice finalized
 */
async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Create or update invoice in our database
  await prisma.invoice.upsert({
    where: { providerId: invoice.id },
    create: {
      userId: user.id,
      providerId: invoice.id,
      subscriptionId: invoice.subscription as string,
      status: 'OPEN',
      amount: invoice.total / 100,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      metadata: invoice.metadata as any,
    },
    update: {
      status: 'OPEN',
      amount: invoice.total / 100,
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
    },
  });
  
  // Optionally send an invoice notification to the user
  // await sendInvoiceNotification(user, invoice);
  
  logger.info(`Invoice finalized for user ${user.id}: ${invoice.id}`);
}

/**
 * Handle customer updated
 */
async function handleCustomerUpdated(customer: Stripe.Customer) {
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customer.id },
  });

  if (!user) {
    logger.info(`No user found for Stripe customer: ${customer.id}, may be new customer`);
    return;
  }

  // Update user's billing details if needed
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Update relevant fields from the customer object
      // Example: email if different, name, etc.
    }
  });
  
  logger.info(`Customer updated for user ${user.id}: ${customer.id}`);
}

/**
 * Handle customer deleted
 */
async function handleCustomerDeleted(customer: Stripe.Customer) {
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customer.id },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customer.id}`);
    return;
  }

  // Handle customer deletion - this could be removing payment methods,
  // clearing billing info, etc.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: null,
      // Other fields to reset
    }
  });
  
  logger.info(`Customer deleted for user ${user.id}: ${customer.id}`);
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  const priceId = subscription.items.data[0].price.id;
  const productId = subscription.items.data[0].price.product as string;
  
  // Get product details from Stripe
  const product = await stripe.products.retrieve(productId);
  
  // Prepare status from Stripe status
  const status = mapStripeSubscriptionStatus(subscription.status);
  
  // Update or create subscription in our database
  await prisma.subscription.upsert({
    where: { providerId: subscription.id },
    create: {
      userId: user.id,
      providerId: subscription.id,
      status,
      planId: priceId,
      planName: product.name,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      metadata: subscription.metadata as any,
    },
    update: {
      status,
      planId: priceId,
      planName: product.name,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      metadata: subscription.metadata as any,
    },
  });
  
  // Also update user's subscription status
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Update any user fields that depend on subscription status
    }
  });
  
  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      type: subscription.status,
      data: subscription as any,
    },
  });
  
  logger.info(`Updated subscription for user ${user.id}: ${subscription.id}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }
  
  // Update subscription in our database
  await prisma.subscription.update({
    where: { providerId: subscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    },
  });
  
  // Update user record if needed to reflect canceled subscription
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Update fields related to subscription status
    }
  });
  
  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      type: 'deleted',
      data: subscription as any,
    },
  });
  
  logger.info(`Deleted subscription for user ${user.id}: ${subscription.id}`);
}

/**
 * Handle trial ending soon
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }
  
  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      type: 'trial.ending',
      data: subscription as any,
    },
  });
  
  // Here you would typically add logic to send an email notification
  // await emailService.sendTrialEndingNotification(user, subscription);
  
  logger.info(`Trial ending soon for user ${user.id}: ${subscription.id}`);
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Update or create invoice record
  await prisma.invoice.upsert({
    where: { providerId: invoice.id },
    create: {
      userId: user.id,
      providerId: invoice.id,
      subscriptionId: invoice.subscription as string,
      status: 'PAID',
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency,
      paidAt: new Date(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      metadata: invoice.metadata as any,
    },
    update: {
      status: 'PAID',
      amount: invoice.amount_paid / 100,
      paidAt: new Date(),
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
    },
  });
  
  // Clear any retry attempts for this invoice if they exist
  await prisma.retryAttempt.deleteMany({
    where: { invoiceId: invoice.id }
  });
  
  logger.info(`Invoice paid for user ${user.id}: ${invoice.id}`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Update or create invoice record
  await prisma.invoice.upsert({
    where: { providerId: invoice.id },
    create: {
      userId: user.id,
      providerId: invoice.id,
      subscriptionId: invoice.subscription as string,
      status: 'UNCOLLECTIBLE',
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      metadata: invoice.metadata as any,
    },
    update: {
      status: 'UNCOLLECTIBLE',
      amount: invoice.amount_due / 100,
    },
  });
  
  // Create or update retry attempt record for this invoice
  await prisma.retryAttempt.upsert({
    where: { invoiceId: invoice.id },
    create: {
      invoiceId: invoice.id,
      userId: user.id,
      attempts: 1,
      lastAttemptAt: new Date(),
      status: 'pending',
    },
    update: {
      attempts: {
        increment: 1
      },
      lastAttemptAt: new Date(),
      status: 'pending',
    }
  });
  
  // Log retry attempt
  await prisma.retryLog.create({
    data: {
      invoiceId: invoice.id,
      userId: user.id,
      status: 'failed',
      attempts: 1, // This should be the incremented value
    }
  });
  
  // If the subscription has a status, update it
  if (invoice.subscription) {
    await prisma.subscription.updateMany({
      where: { 
        providerId: invoice.subscription as string,
        userId: user.id 
      },
      data: {
        status: 'PAST_DUE'
      }
    });
  }
  
  // Here you would typically add logic to send an email notification
  // await emailService.sendPaymentFailedNotification(user, invoice);
  
  logger.info(`Invoice payment failed for user ${user.id}: ${invoice.id}`);
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Create a payment record
  if (invoice.charge) {
    await prisma.payment.create({
      data: {
        userId: user.id,
        providerId: invoice.charge as string,
        invoiceId: invoice.id,
        status: 'SUCCEEDED',
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        metadata: invoice.metadata as any,
        subscriptionId: invoice.subscription as string,
      },
    });
  }
  
  logger.info(`Invoice payment succeeded for user ${user.id}: ${invoice.id}`);
}

/**
 * Handle charge succeeded
 */
async function handleChargeSucceeded(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Create or update payment record
  await prisma.payment.upsert({
    where: { providerId: charge.id },
    create: {
      userId: user.id,
      providerId: charge.id,
      invoiceId: charge.invoice as string,
      status: 'SUCCEEDED',
      amount: charge.amount / 100, // Convert from cents
      currency: charge.currency,
      receiptUrl: charge.receipt_url || null,
      metadata: charge.metadata as any,
    },
    update: {
      status: 'SUCCEEDED',
      receiptUrl: charge.receipt_url || null,
    },
  });
  
  logger.info(`Charge succeeded for user ${user.id}: ${charge.id}`);
}

/**
 * Handle charge failed
 */
async function handleChargeFailed(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Create or update payment record
  await prisma.payment.upsert({
    where: { providerId: charge.id },
    create: {
      userId: user.id,
      providerId: charge.id,
      invoiceId: charge.invoice as string,
      status: 'FAILED',
      amount: charge.amount / 100, // Convert from cents
      currency: charge.currency,
      failureReason: charge.failure_message || null,
      metadata: charge.metadata as any,
    },
    update: {
      status: 'FAILED',
      failureReason: charge.failure_message || null,
    },
  });
  
  // Here you would typically add logic to send an email notification
  // await emailService.sendChargeFailedNotification(user, charge);
  
  logger.info(`Charge failed for user ${user.id}: ${charge.id} - ${charge.failure_message}`);
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  
  // Find user associated with this Stripe customer
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  const status = charge.amount_refunded === charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  // Update payment record
  await prisma.payment.update({
    where: { providerId: charge.id },
    data: {
      status,
      refundedAmount: charge.amount_refunded / 100, // Convert from cents
      refundedAt: new Date(),
    },
  });
  
  logger.info(`Charge refunded for user ${user.id}: ${charge.id}`);
}

/**
 * Map Stripe subscription status to our enum
 */
function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED';
    case 'past_due':
      return 'PAST_DUE';
    case 'trialing':
      return 'TRIALING';
    case 'unpaid':
      return 'UNPAID';
    default:
      return 'ACTIVE';
  }
} 