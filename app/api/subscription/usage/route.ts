import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IPrisma, Prisma } from '@/lib/prisma';
import { IStripe, Stripe } from '@/lib/stripe';
import { Stripe as StripeClient } from 'stripe';
import { InvoiceService, IInvoiceService } from '@/lib/services/invoice-service';
import { UsageService, IUsageService } from '@/lib/services/usage-service';
import { EventManager, IEventManager } from '@/lib/events';
import { BackgroundJobManager, IBackgroundJobManager, IBackgroundJob, BackgroundJob } from '@/lib/background-jobs';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { Config, IConfig } from '@/lib/config';
import { SubscriptionService } from '@/lib/services/subscription-service';

const prisma: IPrisma = new Prisma();
const stripe: IStripe = new StripeClient(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const config: IConfig = new Config()

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceService: IInvoiceService = new InvoiceService(prisma, stripe);
    const usageService: IUsageService = new UsageService(prisma, stripe);
    const eventManager: IEventManager = new EventManager();
    const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager()
    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, config);
    }

    const { featureId, quantity } = await request.json();

    if (!featureId || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Get the active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
      include: {
        pricingPlan: {
          include: {
            planFeatures: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Check if the feature is included in the plan
    const planFeature = subscription.pricingPlan.planFeatures.find(
      (pf) => pf.feature.id === featureId
    );

    if (!planFeature) {
      return NextResponse.json(
        { error: 'Feature not included in current plan' },
        { status: 403 }
      );
    }

    // Create usage record
    const usageRecord = await prisma.usageRecord.create({
      data: {
        subscriptionId: subscription.id,
        featureId,
        quantity,
      },
    });

    // Report usage to Stripe if the subscription has a Stripe ID
    if (subscription.stripeSubscriptionId) {
      try {
        const stripeUsageRecord = await stripe.subscriptionItems.createUsageRecord(
          subscription.stripeSubscriptionId,
          {
            quantity,
            timestamp: Math.floor(Date.now() / 1000),
            action: 'increment',
          }
        );

        // Update the usage record with Stripe ID
        await prisma.usageRecord.update({
          where: { id: usageRecord.id },
          data: {
            stripeUsageRecordId: stripeUsageRecord.id,
            reportedToStripe: true,
          },
        });
      } catch (error) {
        console.error('Error reporting usage to Stripe:', error);
        // Don't fail the request if Stripe reporting fails
      }
    }

    return NextResponse.json({ success: true, usageRecord });
  } catch (error) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: 'Failed to record usage' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('featureId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get the active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Build the query
    const where = {
      subscriptionId: subscription.id,
      ...(featureId && { featureId }),
      ...(startDate && {
        recordedAt: {
          gte: new Date(startDate),
        },
      }),
      ...(endDate && {
        recordedAt: {
          lte: new Date(endDate),
        },
      }),
    };

    // Get usage records
    const usageRecords = await prisma.usageRecord.findMany({
      where,
      include: {
        feature: true,
      },
      orderBy: {
        recordedAt: 'desc',
      },
    });

    // Calculate total usage
    const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);

    return NextResponse.json({
      usageRecords,
      totalUsage,
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
} 