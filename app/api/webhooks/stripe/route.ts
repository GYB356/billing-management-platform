import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import {
  sendSubscriptionConfirmationEmail,
  sendSubscriptionUpdateEmail,
  sendSubscriptionCancellationEmail,
  sendPaymentFailedEmail,
} from '@/lib/email';
import { stripe } from '@/lib/stripe';
import { logAudit } from "@/lib/logging/audit";
import type Stripe from 'stripe';

// Get webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature || !webhookSecret) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing stripe signature or webhook secret' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err);
    return new NextResponse(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
          include: { subscriptions: true },
        });

        if (customer) {
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId: subscription.id },
            create: {
              customerId: customer.id,
              stripeSubscriptionId: subscription.id,
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
            update: {
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
          });

          // Send confirmation email
          await sendSubscriptionConfirmationEmail(
            customer.email,
            subscription.items.data[0].price.nickname || 'Premium Plan',
            subscription.items.data[0].price.unit_amount!,
            subscription.items.data[0].price.currency,
            subscription.items.data[0].price.recurring?.interval || 'month',
            new Date(subscription.current_period_start * 1000)
          );

          // Log the subscription creation
          await logAudit({
            userId: customer.id,
            action: "subscription.created",
            description: `Subscription created with plan ${subscription.items.data[0]?.price.nickname || 'Unknown'}`,
            metadata: {
              subscriptionId: subscription.id,
              planId: subscription.items.data[0]?.price.id,
              status: subscription.status,
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (customer) {
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId: subscription.id },
            create: {
              customerId: customer.id,
              stripeSubscriptionId: subscription.id,
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
            update: {
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
          });

          // Get old plan details from database
          const oldSubscription = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscription.id },
            select: { planId: true },
          });

          // Send update email
          await sendSubscriptionUpdateEmail(
            customer.email,
            oldSubscription?.planId || 'Previous Plan',
            subscription.items.data[0].price.nickname || 'New Plan',
            new Date(subscription.current_period_start * 1000)
          );

          // Log the subscription update
          await logAudit({
            userId: customer.id,
            action: "subscription.updated",
            description: `Subscription updated to status: ${subscription.status}`,
            metadata: {
              subscriptionId: subscription.id,
              planId: subscription.items.data[0]?.price.id,
              status: subscription.status,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (customer) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: 'canceled',
              canceledAt: new Date(),
            },
          });

          // Send cancellation email
          await sendSubscriptionCancellationEmail(
            customer.email,
            subscription.items.data[0].price.nickname || 'Premium Plan',
            new Date(subscription.current_period_end * 1000)
          );

          // Log the subscription cancellation
          await logAudit({
            userId: customer.id,
            action: "subscription.cancelled",
            description: `Subscription cancelled`,
            metadata: {
              subscriptionId: subscription.id,
              planId: subscription.items.data[0]?.price.id,
            },
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case 'payment_method.attached': {
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`Error processing webhook:`, error);
    return new NextResponse(
      JSON.stringify({ error: 'Error processing webhook' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  
  if (!userId) {
    console.error("Payment intent missing userId metadata");
    return;
  }

  // Create a record of the payment
  await prisma.payment.create({
    data: {
      userId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "succeeded",
      paymentIntentId: paymentIntent.id,
      paymentMethodId: paymentIntent.payment_method as string,
    },
  });

  // Log the successful payment
  await logAudit({
    userId,
    action: "payment.succeeded",
    description: `Payment of ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()} succeeded`,
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  
  if (!userId) {
    console.error("Payment intent missing userId metadata");
    return;
  }

  // Create a record of the failed payment
  await prisma.payment.create({
    data: {
      userId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "failed",
      paymentIntentId: paymentIntent.id,
      paymentMethodId: paymentIntent.payment_method as string,
      failureReason: paymentIntent.last_payment_error?.message || "Unknown error",
    },
  });

  // Send payment failed email if we have user information
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email) {
    await sendPaymentFailedEmail(user.email, {
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      dueDate: new Date(),
    });
  }

  // Log the failed payment
  await logAudit({
    userId,
    action: "payment.failed",
    description: `Payment of ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()} failed`,
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      error: paymentIntent.last_payment_error?.message,
    },
  });
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const userId = paymentMethod.metadata?.userId;
  
  if (!userId) {
    console.error("Payment method missing userId metadata");
    return;
  }

  // Store the payment method for future use
  await prisma.userPaymentMethod.create({
    data: {
      userId,
      stripePaymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      cardLast4: paymentMethod.card?.last4,
      cardBrand: paymentMethod.card?.brand,
      cardExpMonth: paymentMethod.card?.exp_month,
      cardExpYear: paymentMethod.card?.exp_year,
      isDefault: false,
    },
  });

  // Log the payment method attachment
  await logAudit({
    userId,
    action: "payment.method_added",
    description: `Payment method ${paymentMethod.card?.brand} ending in ${paymentMethod.card?.last4} was added`,
    metadata: {
      paymentMethodId: paymentMethod.id,
      cardBrand: paymentMethod.card?.brand,
      cardLast4: paymentMethod.card?.last4,
    },
  });
} 