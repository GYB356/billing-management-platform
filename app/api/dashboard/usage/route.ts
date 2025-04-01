import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getUsageSummary } from '@/lib/usage';

export async function GET(request: Request) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const timeframe = url.searchParams.get('timeframe') || 'current';
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: subscriptionId' }, 
        { status: 400 }
      );
    }
    
    // Verify the user has access to this subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              user: {
                email: session.user.email,
              },
            },
          },
        },
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' }, 
        { status: 404 }
      );
    }
    
    // Determine date range based on timeframe
    let startDate: Date;
    let endDate: Date = new Date();
    
    switch (timeframe) {
      case 'last30days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'lastBilling':
        if (subscription.previousPeriodStart && subscription.previousPeriodEnd) {
          startDate = new Date(subscription.previousPeriodStart);
          endDate = new Date(subscription.previousPeriodEnd);
        } else {
          // Fallback to current billing period if previous period not available
          startDate = subscription.currentPeriodStart || new Date(new Date().setMonth(new Date().getMonth() - 1));
          endDate = subscription.currentPeriodEnd || new Date();
        }
        break;
      case 'current':
      default:
        startDate = subscription.currentPeriodStart || new Date(new Date().setMonth(new Date().getMonth() - 1));
        endDate = subscription.currentPeriodEnd || new Date();
        break;
    }
    
    // Get all features for this subscription plan
    const features = subscription.plan.planFeatures.map(pf => pf.feature);
    
    // Calculate usage for each feature
    const usageSummary = await Promise.all(
      features.map(async (feature) => {
        // Get usage records for this feature
        const usageRecords = await prisma.usageRecord.findMany({
          where: {
            subscriptionId,
            featureId: feature.id,
            recordedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        // Calculate total usage
        const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);

        // Get usage tiers for this feature
        const usageTiers = await prisma.usageTier.findMany({
          where: {
            featureId: feature.id,
          },
          orderBy: {
            fromQuantity: 'asc',
          },
        });

        // Find current tier
        const currentTier = usageTiers.find(tier => 
          totalUsage >= tier.fromQuantity && 
          (!tier.toQuantity || totalUsage < tier.toQuantity)
        );

        // Calculate progress to next tier
        const nextTier = usageTiers.find(tier => 
          tier.fromQuantity > totalUsage
        );

        const usageLimit = nextTier ? nextTier.fromQuantity : currentTier?.toQuantity || 0;
        const usagePercentage = usageLimit ? (totalUsage / usageLimit) * 100 : 0;

        return {
          feature,
          totalUsage,
          currentTier,
          nextTier,
          usageLimit,
          usagePercentage: Math.min(usagePercentage, 100),
        };
      })
    );
    
    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planName: subscription.plan.name,
      },
      usageSummary,
      currentPeriodStart: startDate.toISOString(),
      currentPeriodEnd: endDate.toISOString(),
      timeframe,
    });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' }, 
      { status: 500 }
    );
  }
} 