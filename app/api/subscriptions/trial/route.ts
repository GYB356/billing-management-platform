import { NextRequest, NextResponse } from "next/server";
import { createTrialSubscription, extendTrial } from "@/lib/trials";
import { auth } from "@/lib/auth";
import { createEvent, EventManager, EventSeverity } from "@/lib/events";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { IPrisma } from "@/lib/prisma";
import { IStripe } from "@/lib/stripe";
import { Stripe } from "stripe";
import { InvoiceService, IInvoiceService } from "@/lib/services/invoice-service";
import { UsageService, IUsageService } from "@/lib/services/usage-service";
import { SubscriptionService } from "@/lib/services/subscription-service";
import { BackgroundJobManager, IBackgroundJobManager } from "@/lib/background-jobs/background-job-manager";
import { IBackgroundJob, BackgroundJob } from "@/lib/background-jobs/background-job";
import { Config, IConfig } from "@/lib/config";


const prisma: IPrisma = new PrismaClient();
// Validation schema for creating a trial
const createTrialSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  planId: z.string().min(1, "Plan ID is required"),
  trialDays: z.number().positive().optional(),
});

// Validation schema for extending a trial
const extendTrialSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  additionalDays: z.number().positive("Additional days must be positive"),
});

// POST handler to create a trial subscription
export async function POST(req: NextRequest) {
  try {
    const stripe: IStripe = new Stripe(Config.getConfig().stripe.secretKey, {
      apiVersion: "2023-10-16",
    });
    const invoiceService: IInvoiceService = new InvoiceService(prisma, stripe);
    const usageService: IUsageService = new UsageService(prisma);
    const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager();
    const eventManager: EventManager = new EventManager();
    const config: IConfig = Config.getConfig();
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = createTrialSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { organizationId } = validatedData.data;
    
    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      // Regular users should only create trials for their organizations
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!userOrg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    
    // Create trial subscription
    const subscriptionService: SubscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, BackgroundJob, config);

    const subscription = await createTrialSubscription(validatedData.data, subscriptionService);
    
    return NextResponse.json(subscription, { status: 201 });
  } catch (error: any) {
    console.error("Error creating trial subscription:", error);
    
    await createEvent({
      eventType: "TRIAL_CREATE_ERROR",
      resourceType: "SUBSCRIPTION",
      resourceId: "new",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to create trial subscription", message: error.message },
      { status: 500 }
    );
  }
}

// PATCH handler to extend a trial
export async function PATCH(req: NextRequest) {
  try {
    const stripe: IStripe = new Stripe(Config.getConfig().stripe.secretKey, {
      apiVersion: "2023-10-16",
    });
    const invoiceService: IInvoiceService = new InvoiceService(prisma, stripe);
    const usageService: IUsageService = new UsageService(prisma);
    const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager();
    const eventManager: EventManager = new EventManager();
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin access only for extending trials
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = extendTrialSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Extend the trial
    const subscriptionService: SubscriptionService = new SubscriptionService(invoiceService, usageService, prisma, stripe, eventManager, backgroundJobManager, BackgroundJob, Config.getConfig());
    const subscription = await extendTrial(validatedData.data, subscriptionService);
    
    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error("Error extending trial:", error);
    
    await createEvent({
      eventType: "TRIAL_EXTEND_ERROR",
      resourceType: "SUBSCRIPTION",
      resourceId: "extend",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to extend trial", message: error.message },
      { status: 500 }
    );
  }
} 