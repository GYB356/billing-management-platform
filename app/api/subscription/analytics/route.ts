import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get the active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
      include: {
        pricingPlan: {
          include: {
            planFeatures: {
              include: {
                feature: true,
              },
            },
          },
        },
        usageRecords: {
          where: {
            recordedAt: {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined,
            },
          },
          include: {
            feature: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Calculate usage by feature
    const usageByFeature = subscription.usageRecords.reduce((acc, record) => {
      const featureName = record.feature.name;
      if (!acc[featureName]) {
        acc[featureName] = {
          total: 0,
          records: [],
        };
      }
      acc[featureName].total += record.quantity;
      acc[featureName].records.push({
        date: record.recordedAt,
        quantity: record.quantity,
      });
      return acc;
    }, {} as Record<string, { total: number; records: Array<{ date: Date; quantity: number }> }>);

    // Get subscription history
    const subscriptionHistory = await prisma.subscription.findMany({
      where: {
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        pricingPlan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate subscription metrics
    const metrics = {
      currentPlan: subscription.pricingPlan.name,
      status: subscription.status,
      startDate: subscription.startDate,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      totalUsage: subscription.usageRecords.reduce((sum, record) => sum + record.quantity, 0),
      usageByFeature,
      subscriptionHistory: subscriptionHistory.map((sub) => ({
        plan: sub.pricingPlan.name,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        createdAt: sub.createdAt,
      })),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
} 