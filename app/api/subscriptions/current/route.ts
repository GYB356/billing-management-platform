import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { IPrisma } from '@/lib/services/subscription-service';
import { InvoiceService, UsageService, EventManager, BackgroundJobManager, BackgroundJob, Config, Stripe } from '@/lib/index';

const prisma: IPrisma = new PrismaClient();
const invoiceService = new InvoiceService();
const usageService = new UsageService();
const eventManager = new EventManager();
const backgroundJobManager = new BackgroundJobManager();
const config = Config.getConfig();
const stripe = new Stripe(config.stripe.secretKey);

export async function GET() {
  try {
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId: session.user.organizationId,
        status: {
          in: ['ACTIVE', 'TRIALING']
        }
      },
      include: {
        plan: true,
        usageRecords: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!subscription) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: subscription.id,
      status: subscription.status.toLowerCase(),
      planName: subscription.plan.name,
      currentPeriodEnd: subscription.endDate,
      price: subscription.plan.basePrice,
      currency: subscription.plan.currency,
      ...(subscription.usageRecords[0] && {
        usage: {
          current: subscription.usageRecords[0].quantity,
          limit: subscription.plan.usageLimit,
          unit: subscription.plan.usageType
        }
      })
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
} 