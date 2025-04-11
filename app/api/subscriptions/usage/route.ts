import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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