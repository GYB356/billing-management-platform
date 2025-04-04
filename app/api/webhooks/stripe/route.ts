import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  sendSubscriptionConfirmationEmail,
  sendSubscriptionUpdateEmail,
  sendSubscriptionCancellationEmail,
  sendPaymentFailedEmail,
} from '@/lib/email';
import { stripe } from '@/lib/stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return new NextResponse('No signature', { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

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
          await sendSubscriptionConfirmationEmail(customer.email, {
            planName: subscription.items.data[0].price.nickname || 'Premium Plan',
            amount: subscription.items.data[0].price.unit_amount! / 100,
            interval: subscription.items.data[0].price.recurring?.interval || 'month',
            startDate: new Date(subscription.current_period_start * 1000),
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

          // Send update email
          await sendSubscriptionUpdateEmail(customer.email, {
            planName: subscription.items.data[0].price.nickname || 'Premium Plan',
            amount: subscription.items.data[0].price.unit_amount! / 100,
            interval: subscription.items.data[0].price.recurring?.interval || 'month',
            effectiveDate: new Date(subscription.current_period_start * 1000),
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
          await sendSubscriptionCancellationEmail(customer.email, {
            planName: subscription.items.data[0].price.nickname || 'Premium Plan',
            endDate: new Date(subscription.current_period_end * 1000),
          });
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { invoiceId, subscriptionId, organizationId } = session.metadata as {
          invoiceId: string;
          subscriptionId: string;
          organizationId: string;
        };

        // Update invoice status
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            payment: {
              create: {
                amount: session.amount_total || 0,
                currency: session.currency,
                status: 'SUCCEEDED',
                method: 'CREDIT_CARD',
                stripeId: session.payment_intent as string,
              },
            },
          },
        });

        // Update subscription status if needed
        if (subscriptionId) {
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
          });
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Update invoice status
        await prisma.invoice.update({
          where: { stripeInvoiceId: invoice.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            payment: {
              create: {
                amount: invoice.amount_paid || 0,
                currency: invoice.currency,
                status: 'SUCCEEDED',
                method: 'CREDIT_CARD',
                stripeId: invoice.payment_intent as string,
              },
            },
          },
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Update invoice status
        await prisma.invoice.update({
          where: { stripeInvoiceId: invoice.id },
          data: {
            status: 'OVERDUE',
          },
        });

        // Get customer email
        const customer = await prisma.organization.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
          select: { email: true },
        });

        if (customer?.email) {
          // Send payment failed email
          await sendPaymentFailedEmail(customer.email, {
            amount: (invoice.amount_due || 0) / 100,
            dueDate: new Date((invoice.due_date || 0) * 1000),
            retryDate: new Date(((invoice.next_payment_attempt || invoice.due_date) || 0) * 1000),
          });
        }

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        // Find and update payment status
        await prisma.payment.update({
          where: { stripeId: charge.payment_intent as string },
          data: {
            status: 'REFUNDED',
          },
        });

        // Update invoice status
        await prisma.invoice.update({
          where: {
            payment: {
              stripeId: charge.payment_intent as string,
            },
          },
          data: {
            status: 'REFUNDED',
          },
        });

        break;
      }
    }

    return new NextResponse('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Webhook error', { status: 400 });
  }
} 