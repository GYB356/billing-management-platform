import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { z } from 'zod';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { Stripe } from 'stripe';
import { EventManager } from '@/lib/events/events';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { Config } from '@/lib/config';

const prisma = new PrismaClient();
const stripe = new Stripe(Config.getConfig().stripe.secretKey as string, { apiVersion: '2023-10-16' });
const eventManager = new EventManager();
const backgroundJobManager = new BackgroundJobManager();
// Validation schema for request
const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  cancelImmediately: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const config = Config.getConfig();
  const invoiceService = new InvoiceService(prisma);
  const usageService = new UsageService(prisma);
  const subscriptionService = new SubscriptionService(
    invoiceService,
    usageService,
    prisma,
    stripe,
    eventManager,
    backgroundJobManager,
    BackgroundJob,
    config
  );
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = cancelSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { subscriptionId, cancelImmediately, reason } = validationResult.data;

    // Check if the user has permission to manage this subscription
    const subscription = await prisma.subscription.findFirst({
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

    // Use the subscription service to cancel the subscription
    const updatedSubscription = await subscriptionService.cancelSubscription(subscriptionId, cancelImmediately);

    return NextResponse.json(updatedSubscription);
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
} 