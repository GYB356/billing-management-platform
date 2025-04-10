import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateUsageCharges } from '@/lib/usage';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const subscriptionId = searchParams.get('subscriptionId');
    const featureId = searchParams.get('featureId');
    const timeRange = searchParams.get('timeRange') || 'billing';

    if (!subscriptionId) {
      return new NextResponse('Subscription ID is required', { status: 400 });
    }

    // Verify user has access to this subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: {
          include: {
            users: {
              where: { id: session.user.id },
            },
          },
        },
      },
    });

    if (!subscription) {
      return new NextResponse('Subscription not found', { status: 404 });
    }

    if (!subscription.organization.users.length) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Determine the time period
    const now = new Date();
    let startDate: Date;
    const endDate = now;

    switch (timeRange) {
      case '7days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      case 'billing':
      default:
        startDate = subscription.currentPeriodStart || new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    // Get usage records
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        ...(featureId ? { featureId } : {}),
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        feature: true,
      },
      orderBy: {
        recordedAt: 'asc',
      },
    });

    // Group usage by date
    const usageByDate = usageRecords.reduce((acc, record) => {
      const date = record.recordedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          usage: 0,
          cost: 0,
        };
      }
      acc[date].usage += record.quantity;
      acc[date].cost += calculateUsageCharges(record.quantity, record.feature);
      return acc;
    }, {} as Record<string, { date: string; usage: number; cost: number }>);

    // Convert to array and sort by date
    const usageData = Object.values(usageByDate).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json(usageData);
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 