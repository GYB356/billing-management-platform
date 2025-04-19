import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IPrisma } from '@/lib/prisma';
import { IStripe } from '@/lib/stripe';
import { InvoiceService, IInvoiceService } from '@/lib/services/invoice-service';
import { UsageService, IUsageService } from '@/lib/services/usage-service';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { EventManager, IEventManager } from '@/lib/events';
import { BackgroundJobManager, IBackgroundJobManager, IBackgroundJob } from '@/lib/background-jobs/background-job-manager';
import { Config, IConfig } from '@/lib/config';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); 
    }
    const prisma = new PrismaClient();
    const config: IConfig = new Config();
    const stripe: IStripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
    const invoiceService: IInvoiceService = new InvoiceService(prisma);
    const usageService: IUsageService = new UsageService(prisma);
    const eventManager: IEventManager = new EventManager();
    const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager();
    const backgroundJob: IBackgroundJob = new BackgroundJobManager();
    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, config, backgroundJob);

    // Get customer with active subscription
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const subscription = customer.subscriptions[0];

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Get the default payment method
    let paymentMethod = null;

    if (stripeCustomer.invoice_settings.default_payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
        stripeCustomer.invoice_settings.default_payment_method as string,
        {
          expand: ['billing_details.address'],
        }
      );

      if (pm.type === 'card') {
        paymentMethod = {
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expiryMonth: pm.card?.exp_month,
          expiryYear: pm.card?.exp_year,
        };
      }
    }

    // Get usage data if applicable
    const usage = await prisma.usage.findMany({ 
      where: {
        subscriptionId: subscription.id,
        timestamp: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate usage metrics
    const usageMetrics = usage.reduce(
      (acc, curr) => {
        acc.total += curr.quantity;
        if (curr.type === 'API_CALLS') acc.apiCalls += curr.quantity;
        if (curr.type === 'STORAGE') acc.storage += curr.quantity;
        return acc;
      },
      { total: 0, apiCalls: 0, storage: 0 }
    );

    return NextResponse.json({
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        price: subscription.plan.price,
        interval: subscription.plan.interval,
        features: subscription.plan.features,
        limits: subscription.plan.limits,
      },
      usage: usageMetrics,
      paymentMethod,
      stripeCustomerId: customer.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription data' }, 
      { status: 500 }
    );
  }
}
