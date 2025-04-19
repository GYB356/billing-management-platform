import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { Stripe } from 'stripe';
import { EventManager } from '@/lib/events';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { Config } from '@/lib/config';
import { IPrisma, IStripe, IEventManager, IBackgroundJobManager, IConfig } from '@/lib/services/types';
import { SubscriptionService } from '@/lib/services/subscription-service';

const prisma: IPrisma = new PrismaClient();
const stripe: IStripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
const eventManager: IEventManager = new EventManager();
const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager();
const config: IConfig = Config.getConfig();

const subscriptionService = new SubscriptionService(new InvoiceService(), new UsageService(), prisma, stripe, eventManager, backgroundJobManager, BackgroundJob, config);
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, cardNumber, expiryDate, cvv, name } = body;

    // Create a payment method
    const paymentMethod = await (stripe as Stripe).paymentMethods.create({
      type: 'card',
      card: {
          number: cardNumber,
        exp_month: parseInt(expiryDate.split('/')[0]),
        exp_year: parseInt(expiryDate.split('/')[1]),
        cvc: cvv,
        billing_details: {
          name,
          email,
        },
      },
    });

    // Create a customer if they don't exist
    let customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
    });

    if (!customer) {
      const stripeCustomer = await (stripe as Stripe).customers.create({
        email,
        payment_method: paymentMethod.id,
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      customer = await prisma.customer.create({
        data: {
          userId: session.user.id,
          stripeCustomerId: stripeCustomer.id,
          email,
        },
      });
    }

    // Create a subscription
    const subscription = await (stripe as Stripe).subscriptions.create({
      customer: customer.stripeCustomerId,
      items: [{ price: process.env.STRIPE_PRICE_ID }], // You'll need to set this in your .env
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as Stripe.Invoice)
        .payment_intent?.client_secret,
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}