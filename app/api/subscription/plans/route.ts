import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IPrisma, IStripe, IInvoiceService, IUsageService, IEventManager, IBackgroundJobManager, IBackgroundJob, IConfig } from '@/lib/types';
import { sendSubscriptionPauseEmail } from '@/lib/email';
import SubscriptionService from '@/lib/services/subscription-service';
import InvoiceService from '@/lib/services/invoice-service';
import UsageService from '@/lib/services/usage-service';
import { stripeApi } from '@/lib/stripe';
import EventManager, { IEventManager } from '@/lib/events';
import BackgroundJobManager from '@/lib/background-jobs/background-job-manager';
import BackgroundJob, { IBackgroundJob } from '@/lib/background-jobs/background-job';
import Config, { IConfig } from '@/lib/config';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Validation schema for request

const prisma: IPrisma = new PrismaClient();
const invoiceService: IInvoiceService = new InvoiceService();
const usageService: IUsageService = new UsageService();
const eventManager: IEventManager = new EventManager();
const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager();
const pauseSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  pauseDuration: z.number().min(1).max(90),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const config:IConfig = Config.getConfig()
  const stripe:IStripe = stripeApi;
  const backgroundJob: IBackgroundJob = BackgroundJob;
  try {
      const backgroundJob = BackgroundJob;
      const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, Stripe, eventManager, backgroundJobManager, config, backgroundJob);


    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = pauseSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { subscriptionId, pauseDuration, reason } = validationResult.data;

    // Check if the user has permission to manage this subscription
    const subscription = await (prisma as PrismaClient).subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to manage it' },
        { status: 404 }
      );
    }

    // Use the subscription service to pause the subscription
    const updatedSubscription = await subscriptionService.pauseSubscription(
      subscriptionId,
      pauseDuration,
      reason
    );

    return NextResponse.json(updatedSubscription);
  } catch (error: any) {
    console.error('Error pausing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause subscription' },
      { status: 500 }
    );
  }
} 