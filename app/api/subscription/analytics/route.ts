import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { IPrisma } from '@/lib/prisma';
import { IStripe } from '@/lib/stripe';
import { EventManager } from '@/lib/events';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { Config } from '@/lib/config';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

export async function GET(request: Request) {
  try {
    const prisma = new PrismaClient() as IPrisma;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const invoiceService = new InvoiceService();
    const usageService = new UsageService();
    const stripe = new Stripe(Config.getConfig().stripeSecretKey as string, {
      apiVersion: '2023-10-16',
    }) as IStripe;
    const eventManager = new EventManager();
    const backgroundJobManager = new BackgroundJobManager()
    const config = Config.getConfig();

    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, BackgroundJob, config);
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
        usageRecords: {
          
          where: {
            recordedAt: {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined,
            },
          },
          include: {
            feature: true,
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

    const subscriptionHistory = await prisma.subscription.findMany({      
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        pricingPlan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const metrics = await subscriptionService.getSubscriptionMetrics(subscription, subscriptionHistory)

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
} 