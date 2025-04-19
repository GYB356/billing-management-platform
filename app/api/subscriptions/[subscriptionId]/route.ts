import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '../../../../lib/services/invoice-service';
import { UsageService } from '../../../../lib/services/usage-service';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { EventManager } from '../../../../lib/events';
import { BackgroundJobManager } from '../../../../lib/background-jobs/background-job-manager';
import { BackgroundJob } from '../../../../lib/background-jobs/background-job';
import { Config } from '../../../../lib/config';
import { SubscriptionService } from '../../../../lib/services/subscription-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  const { subscriptionId } = params;

  // Create instances of dependencies
  const invoiceService = new InvoiceService();
  const usageService = new UsageService();
  const prisma = new PrismaClient();
  const stripe = new Stripe(Config.getConfig().stripe.secretKey, {
    apiVersion: '2023-10-16',
  });
  const eventManager = new EventManager();
  const backgroundJobManager = new BackgroundJobManager();
  const backgroundJob = BackgroundJob;
  const config = Config.getConfig();

  // Inject dependencies into SubscriptionService
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
}