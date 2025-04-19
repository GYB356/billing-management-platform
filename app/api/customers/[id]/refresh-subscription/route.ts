import { NextRequest, NextResponse } from 'next/server';
import { IInvoiceService } from '@/lib/services/invoice-service.js';
import { IUsageService } from '@/lib/services/usage-service.js';
import { IPrisma } from '@/lib/prisma.js';
import { IStripe } from '@/lib/stripe.js';
import { IEventManager } from '@/lib/events.js';
import { IBackgroundJobManager, IBackgroundJob } from '@/lib/background-jobs/background-job.js';
import { IConfig } from '@/lib/config.js';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { InvoiceService } from '@/lib/services/invoice-service.js';
import { UsageService } from '@/lib/services/usage-service.js';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { EventManager } from '@/lib/events.js';
import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager.js';
import { Config } from '@/lib/config.js';
import { BackgroundJob } from '@/lib/background-jobs/background-job.js';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const invoiceService: IInvoiceService = new InvoiceService();
    const usageService: IUsageService = new UsageService();
    const prisma: IPrisma = new PrismaClient();
    const stripe: IStripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
    const eventManager: IEventManager = new EventManager();
    const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager(prisma, eventManager);
    const config: IConfig = new Config();
    const backgroundJob: IBackgroundJob = new BackgroundJob(backgroundJobManager, config);
    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, config, backgroundJob);
    const subscriptionId = params.id;

    try {
        const updatedSubscription = await subscriptionService.refreshSubscription(subscriptionId);
        return NextResponse.json(updatedSubscription);
    } catch (error) {
        console.error('Error refreshing subscription:', error);
        return new NextResponse(JSON.stringify({ error: 'Failed to refresh subscription' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}