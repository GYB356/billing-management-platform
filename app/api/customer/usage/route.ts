import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        userOrganizations: {
          include: {
            organization: {
              include: {
                subscriptions: {
                  where: { status: 'ACTIVE' },
                  include: {
                    plan: {
                      include: {
                        features: {
                          include: {
                            feature: true,
                          },
                        },
                      },
                    },
                    usageRecords: {
                      where: {
                        timestamp: {
                          gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
                        },
                      },
                      orderBy: {
                        timestamp: 'desc',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const subscription = user?.userOrganizations?.[0]?.organization?.subscriptions?.[0];
    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Calculate usage for each feature
    const usageMetrics = subscription.plan.features.map((featureAssoc) => {
      const feature = featureAssoc.feature;
      const usageRecords = subscription.usageRecords.filter(
        (record) => record.featureId === feature.id
      );

      const currentUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);
      const limit = featureAssoc.limits ? JSON.parse(featureAssoc.limits).maxValue : Infinity;

      return {
        name: feature.name,
        current: currentUsage,
        limit: limit,
        unit: feature.unitName || 'units',
      };
    });

    return NextResponse.json(usageMetrics);
  } catch (error) {
    console.error('Usage fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
