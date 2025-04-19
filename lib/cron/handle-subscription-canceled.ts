import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { sendGoodbyeEmail } from '../emails/goodbye-email';
import { SubscriptionService } from '../services/subscription-service';
import { InvoiceService } from '../services/invoice-service';
import { UsageService } from '../services/usage-service';
import { EventManager } from '../events';
import { BackgroundJobManager, BackgroundJob } from '../background-jobs';
import { Config } from '../config';
import { IConfig } from '../services/subscription-service';

export const handleSubscriptionCanceled = async (data: { subscriptionId: string, userEmail: string }) => {
  console.log(`Subscription with ID ${data.subscriptionId} was canceled for user ${data.userEmail}.`);

    // Create instances of the services and dependencies
    const prisma = new PrismaClient();
    const stripe = new Stripe(Config.getConfig().stripeSecretKey, {
        apiVersion: '2023-10-16',
    });
    const eventManager = new EventManager();
    const backgroundJobManager = new BackgroundJobManager();
    const config = Config.getConfig() as unknown as IConfig;

    const invoiceService = new InvoiceService(prisma, stripe, config);
    const usageService = new UsageService(prisma, config);
    const backgroundJob = BackgroundJob;

    // Create an instance of SubscriptionService with the dependencies injected
    const subscriptionService = new SubscriptionService(
        invoiceService,
        usageService,
        prisma,
        stripe,
        eventManager,
        backgroundJobManager,
        backgroundJob,
        config
    );

    await sendGoodbyeEmail(data.userEmail);
};
