import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IPrisma } from '@/lib/prisma';
import { IInvoiceService } from '@/lib/services/invoice-service';
import { IUsageService } from '@/lib/services/usage-service';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { IStripe } from '@/lib/stripe';
import { IEventManager } from '@/lib/events';
import { IBackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { IBackgroundJob } from '@/lib/background-jobs/background-job';
import { IConfig } from '@/lib/config';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import Stripe from 'stripe';
import { EventManager } from '@/lib/events';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { Config } from '@/lib/config';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const prisma = new PrismaClient();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { plan: true }
    });
    const invoiceService = new InvoiceService();
    const usageService = new UsageService();
    const stripe = new Stripe(Config.getConfig().stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
    const config = Config.getConfig();
    const eventManager = new EventManager();
    const backgroundJobManager = new BackgroundJobManager();
    const subscriptionService = new SubscriptionService(invoiceService as IInvoiceService, usageService as IUsageService, prisma as IPrisma, stripe as IStripe, eventManager as IEventManager, backgroundJobManager as IBackgroundJobManager, BackgroundJob as unknown as typeof IBackgroundJob, config as IConfig);
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}