import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { Stripe } from 'stripe';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { EventManager } from '@/lib/events';
import { BackgroundJobManager, BackgroundJob } from '@/lib/background-jobs';
import { Config } from '@/lib/config';

export async function GET() {
  const prisma = new PrismaClient();
  const invoiceService = new InvoiceService();
  const usageService = new UsageService();
  const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, new Stripe(Config.getConfig().stripeSecretKey), new EventManager(), new BackgroundJobManager(new BackgroundJob(), prisma), new Config());
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { 
        userId: session.user.id,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return new NextResponse('No active subscription found', { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) { 
    if (error instanceof Error) {
      console.error('Error fetching subscription:', error.message);
    }
    console.error('Error fetching subscription:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 