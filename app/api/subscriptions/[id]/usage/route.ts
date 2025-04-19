import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/rbac';
import {
  recordUsage,
  getUsageRecords,
  getSubscriptionUsageSummary,
} from '@/lib/services/usage-service';
import { z } from 'zod';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { InvoiceService } from '@/lib/services/invoice-service';
import { UsageService } from '@/lib/services/usage-service';
import { PrismaClient } from '@prisma/client';
import { Stripe } from 'stripe';
import { EventManager } from '@/lib/events/event-manager';
import { BackgroundJobManager, BackgroundJob } from '@/lib/jobs/background-job-manager';
import { Config } from '@/lib/config';


// Schema validation for recording usage
const recordUsageSchema = z.object({
  featureId: z.string(),
  quantity: z.number().positive(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET endpoint to retrieve usage records
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const prisma = new PrismaClient();
  const stripe = new Stripe(Config.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  });
  const invoiceService = new InvoiceService(prisma, stripe);
  const usageService = new UsageService(prisma);
  const eventManager = new EventManager();
  const backgroundJobManager = new BackgroundJobManager(
    prisma,
    new BackgroundJob()
  );
  const subscriptionService = new SubscriptionService(
    invoiceService,
    usageService,
    prisma,
    stripe,
    eventManager,
    backgroundJobManager,
    Config
  );

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the user has permission to view subscriptions
    try {
      requirePermission(session.user.role as any, session.user.organizationRole as any || 'MEMBER', 'view:subscriptions');
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const subscriptionId = params.id;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('featureId') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const summary = searchParams.get('summary') === 'true';

    // Check if the subscription exists and user has access
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    if (summary) {    
      // If summary is requested, return aggregated usage
      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'startDate and endDate are required for summary view' },
          { status: 400 }
        );
      }

      const usageSummary = await getSubscriptionUsageSummary(subscriptionId, startDate, endDate);


      return NextResponse.json(usageSummary);
    } else {
      // Return detailed usage records
      const usageRecords = await getUsageRecords(subscriptionId, {
        featureId,
        startDate,
        endDate,
        limit,
        offset: (page - 1) * limit,
      });

      return NextResponse.json({
        ...usageRecords,
        meta: {
          ...usageRecords.meta,
          page,
          totalPages: Math.ceil(usageRecords.meta.total / limit),
        },
      });
    }
  } catch (error: any) {
    console.error('Error retrieving usage records:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve usage records' },
      { status: 500 }
    );
  }
}

// POST endpoint to record usage
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const prisma = new PrismaClient();
  const stripe = new Stripe(Config.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  });
  const invoiceService = new InvoiceService(prisma, stripe);
  const usageService = new UsageService(prisma);
  const eventManager = new EventManager();
  const backgroundJobManager = new BackgroundJobManager(
    prisma,
    new BackgroundJob()
  );
  const subscriptionService = new SubscriptionService(
    invoiceService,
    usageService,
    prisma,
    stripe,
    eventManager,
    backgroundJobManager,
    Config
  );

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the user has permission to manage subscriptions
    try {
      requirePermission(session.user.role as any, session.user.organizationRole as any || 'MEMBER', 'manage:subscriptions');
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const subscriptionId = params.id;

    // Validate request body
    const body = await request.json();
    const validationResult = recordUsageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { featureId, quantity, timestamp, metadata } = validationResult.data;

    // Verify that the feature exists
    const feature = await prisma.feature.findUnique({
      where: { id: featureId }
    });

    if (!feature) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }
    
    // Check if the subscription exists and user has access
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    //Record the usage
    const usageRecord = await recordUsage({
      subscriptionId,
      featureId,
      quantity,
      timestamp: timestamp ? new Date(timestamp) : undefined,
      metadata,
    });

    return NextResponse.json(usageRecord, { status: 201 });
  } catch (error: any) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record usage' },
      { status: 500 }
    );
  }
}