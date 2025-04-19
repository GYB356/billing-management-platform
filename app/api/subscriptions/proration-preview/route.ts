import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { Stripe } from 'stripe';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { EventManager } from '@/lib/events';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { Config } from '@/lib/config';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { IBackgroundJob, IConfig, IEventManager, IPrisma, IStripe } from '@/lib/types';
import { BackgroundJob } from '@/lib/background-jobs/background-job';

const prisma: IPrisma = new PrismaClient();
const stripe: IStripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const config: IConfig = Config.getConfig();
const backgroundJob: IBackgroundJob = BackgroundJob;
export async function POST(req: NextRequest) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const eventManager: IEventManager = new EventManager();
    const backgroundJobManager = new BackgroundJobManager(backgroundJob);
    const invoiceService = new InvoiceService();
    const usageService = new UsageService();
    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, config, backgroundJob);

    // Parse request body
    const { subscriptionId, newPlanId, quantity = 1 } = await req.json();

    if (!subscriptionId || !newPlanId) {
      return NextResponse.json(
        { error: 'Subscription ID and new plan ID are required' },
        { status: 400 }
      );
    }

    // Fetch subscription from database
    const subscription = await (prisma as IPrisma).subscription.findUnique({
      where: {
        id: subscriptionId,
        userId: session.user.id,
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Validate subscription has a Stripe subscription ID
    if (!subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Subscription has no associated Stripe subscription' },
        { status: 400 }
      );
    }

    // Get the new plan
    const newPlan = await (prisma as IPrisma).plan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      return NextResponse.json(
        { error: 'New plan not found' },
        { status: 404 }
      );
    }

    // Skip if it's the same plan with the same quantity
    if (subscription.planId === newPlanId && subscription.quantity === quantity) {
      return NextResponse.json({
        proratedAmount: 0,
        currency: subscription.plan.currency || 'usd',
      });
    }

    // Calculate proration
    // First, get the Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    if (!stripeSubscription) {
      return NextResponse.json(
        { error: 'Failed to retrieve Stripe subscription' },
        { status: 400 }
      );
    }

    // We need the current subscription item ID and the new price ID
    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Get the Stripe price ID for the new plan
    if (!newPlan.stripePriceId) {
      return NextResponse.json(
        { error: 'New plan has no associated Stripe price' },
        { status: 400 }
      );
    }

    // Calculate proration preview using Stripe's invoice preview
    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: stripeSubscription.customer as string,
      subscription: stripeSubscription.id,
      subscription_items: [{
        id: subscriptionItemId,
        price: newPlan.stripePriceId,
        quantity,
      }],
    });

    // Extract the prorated amount
    // For plan changes, Stripe returns the prorated amount in the next invoice
    const proratedAmount = invoice.amount_due;
    
    // Return the proration preview
    return NextResponse.json({
      proratedAmount,
      currency: invoice.currency,
      invoiceDate: new Date(invoice.period_end * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Error calculating proration:', error);
    
    // Handle Stripe errors gracefully
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message || 'Invalid request to Stripe' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to calculate proration' },
      { status: 500 }
    );
  }
} 