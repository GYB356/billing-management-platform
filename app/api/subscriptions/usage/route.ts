import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "@/lib/services/invoice-service";
import { UsageService } from "@/lib/services/usage-service";
import { Stripe } from "stripe";
import { EventManager } from "@/lib/events";
import { BackgroundJobManager } from "@/lib/background-jobs/background-job-manager";
import { BackgroundJob } from "@/lib/background-jobs/background-job";
import { Config } from "@/lib/config";
import { SubscriptionService } from "@/lib/services/subscription-service";

export async function GET(request: Request) {

  try {
    const session = await auth();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return new NextResponse('Subscription ID is required', { status: 400 });
    }

    const prisma = new PrismaClient();
    const invoiceService = new InvoiceService();
    const usageService = new UsageService();
    const stripe = new Stripe(Config.getConfig().stripe.secretKey, {
      apiVersion: "2023-10-16",
    });
    const eventManager = new EventManager();
    const backgroundJobManager = new BackgroundJobManager();
    const backgroundJob = BackgroundJob;
    const config = Config;
    const subscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, backgroundJob, config);

    
     // Get subscription to verify access
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
      },
    });

    if (!subscription) {
      return new NextResponse('Subscription not found', { status: 404 });
    }

    // Get current billing period
    const currentPeriodStart = subscription.currentPeriodStart;
    const currentPeriodEnd = subscription.currentPeriodEnd;

    // Get usage records for the current billing period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        timestamp: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group usage records by feature
    const usage: Record<string, any[]> = {};
    usageRecords.forEach(record => {
      if (!usage[record.featureKey]) {
        usage[record.featureKey] = [];
      }
      usage[record.featureKey].push({
        quantity: record.quantity,
        timestamp: record.timestamp,
      });
    });

    return NextResponse.json({
      usage,
      currentPeriodStart,
      currentPeriodEnd,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 