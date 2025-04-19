import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { SubscriptionService } from '@/lib/services/subscription-service/subscription-service';
import { ISubscriptionService } from '@/lib/services/subscription-service/subscription-service.interface';
import { InvoiceService } from '@/lib/services/invoice-service/invoice-service';
import { UsageService } from '@/lib/services/usage-service/usage-service';
import { Stripe } from 'stripe';
import { EventManager } from '@/lib/services/event-manager';
import { BackgroundJobManager } from '@/lib/services/background-job-manager';
import { BackgroundJob } from '@/lib/services/background-job-manager/background-job';
import { Config } from '@/lib/config';

const prisma = new PrismaClient();
const config = new Config();
const stripe = new Stripe(config.stripe.secretKey as string, { apiVersion: '2023-10-16' });
const eventManager = new EventManager();
const backgroundJobManager = new BackgroundJobManager();
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get subscription id from params
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Validate that this subscription belongs to the authenticated user
    const subscription = await prisma.subscription.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Make sure the subscription is in a state that needs payment retry
    if (subscription.status !== 'past_due' && subscription.status !== 'unpaid') {
      return NextResponse.json(
        { error: 'Only subscriptions with payment issues can be retried' },
        { status: 400 }
      );
    }

    // Get request body for optional parameters
    const { paymentMethodId } = await req.json();

    // Initialize the subscription service
    const subscriptionService: ISubscriptionService = new SubscriptionService(
      new InvoiceService(prisma, stripe, eventManager, config),
      new UsageService(prisma, eventManager, config),
      prisma,
      stripe,
      eventManager,
      backgroundJobManager,
      new BackgroundJob() ,
      config
    );

    // Retry the payment
    const result = await subscriptionService.retryFailedPayment({
      subscriptionId: id,
      paymentMethodId, // Optional - if provided, will update the payment method first
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to retry payment' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        message: 'Payment retry initiated successfully',
        invoice: result.invoice,
        subscription: result.subscription 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error retrying payment:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrying payment' },
      { status: 500 }
    );
  }
} 