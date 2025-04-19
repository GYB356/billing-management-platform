import { NextRequest, NextResponse } from 'next/server';
import { type IInvoiceService, InvoiceService } from '@/lib/services/invoice-service';
import { type IUsageService, UsageService } from '@/lib/services/usage-service';
import { type IPrisma } from '@/lib/prisma';
import { type IStripe } from '@/lib/stripe';
import { type IEventManager, EventManager } from '@/lib/events';
import { type IBackgroundJobManager, type IBackgroundJob, BackgroundJobManager, BackgroundJob } from '@/lib/background-jobs/background-job';
import { type IConfig, Config } from '@/lib/config';
import { type ISubscriptionService, SubscriptionService } from '@/lib/services/subscription-service';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const invoiceService: IInvoiceService = new InvoiceService();
    const usageService: IUsageService = new UsageService();
    const prisma: IPrisma = new PrismaClient() as IPrisma;
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