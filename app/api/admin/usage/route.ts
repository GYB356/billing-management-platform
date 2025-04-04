import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateUsageCharges } from '@/lib/usage';

export async function GET(request: Request) {
  try {
    // Check if user is an admin
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const featureId = url.searchParams.get('featureId');
    const timeRange = url.searchParams.get('timeRange') || 'billing';

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
        // Use the current billing period for each subscription
        // Logic handled differently below
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    // Build the query filter
    const filter: any = {
      subscription: {
        status: 'ACTIVE',
      },
    };

    if (customerId) {
      filter.subscription.organizationId = customerId;
    }

    if (featureId) {
      filter.featureId = featureId;
    }

    // If using billing period, we need to handle each subscription separately
    let totalUsage = 0;
    let totalEstimatedCost = 0;
    let activeCustomers = 0;
    let customers: any[] = [];

    if (timeRange === 'billing') {
      // Get all active subscriptions
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          ...(customerId ? { organizationId: customerId } : {}),
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Process each subscription individually
      for (const subscription of subscriptions) {
        const subscriptionStart = subscription.currentPeriodStart || startDate;
        const subscriptionEnd = subscription.currentPeriodEnd || endDate;

        // Get all usage records for this subscription
        const usageRecords = await prisma.usageRecord.findMany({
          where: {
            subscriptionId: subscription.id,
            ...(featureId ? { featureId } : {}),
            recordedAt: {
              gte: subscriptionStart,
              lte: subscriptionEnd,
            },
          },
          include: {
            feature: true,
          },
        });

        // Skip if no usage records
        if (usageRecords.length === 0) continue;

        // Calculate usage by feature
        const featureUsage: Record<string, { 
          id: string;
          name: string; 
          usage: number;
          unitName?: string;
          cost?: number;
          usageLimit?: number;
          currentTier?: any;
        }> = {};

        for (const record of usageRecords) {
          if (!featureUsage[record.featureId]) {
            featureUsage[record.featureId] = {
              id: record.featureId,
              name: record.feature.name,
              usage: 0,
              unitName: record.feature.unitName,
            };
          }
          featureUsage[record.featureId].usage += record.quantity;
        }

        // Get usage tiers for each feature and calculate cost
        for (const featureId of Object.keys(featureUsage)) {
          const usageTiers = await prisma.usageTier.findMany({
            where: { featureId },
            orderBy: { fromQuantity: 'asc' },
          });

          if (usageTiers.length > 0) {
            // Find current tier
            const currentTier = usageTiers.find(tier => 
              featureUsage[featureId].usage >= tier.fromQuantity && 
              (!tier.toQuantity || featureUsage[featureId].usage < tier.toQuantity)
            );

            // Calculate cost
            let cost = 0;
            let remainingUsage = featureUsage[featureId].usage;

            for (const tier of usageTiers) {
              if (remainingUsage <= 0) break;

              const tierUsage = tier.toQuantity 
                ? Math.min(remainingUsage, tier.toQuantity - tier.fromQuantity)
                : remainingUsage;

              if (tier.unitPrice) {
                cost += tierUsage * tier.unitPrice;
              } else if (tier.flatPrice && remainingUsage > 0) {
                cost += tier.flatPrice;
              }

              remainingUsage -= tierUsage;
            }

            // Set the additional feature info
            featureUsage[featureId].cost = cost;
            featureUsage[featureId].currentTier = currentTier;
            
            // Find the next tier for usage limit info
            if (currentTier && currentTier.toQuantity) {
              featureUsage[featureId].usageLimit = currentTier.toQuantity;
            } else {
              const nextTier = usageTiers.find(tier => 
                tier.fromQuantity > featureUsage[featureId].usage
              );
              if (nextTier) {
                featureUsage[featureId].usageLimit = nextTier.fromQuantity;
              }
            }
          }
        }

        // Calculate total usage and cost for this customer
        const customerTotalUsage = Object.values(featureUsage).reduce(
          (sum, feature) => sum + feature.usage, 0
        );
        
        const customerEstimatedCost = Object.values(featureUsage).reduce(
          (sum, feature) => sum + (feature.cost || 0), 0
        );

        // Add to overall totals
        totalUsage += customerTotalUsage;
        totalEstimatedCost += customerEstimatedCost;
        activeCustomers++;

        // Add customer to the result set
        customers.push({
          id: subscription.organization.id,
          name: subscription.organization.name,
          email: subscription.organization.email,
          subscriptionId: subscription.id,
          totalUsage: customerTotalUsage,
          estimatedCost: customerEstimatedCost,
          features: Object.values(featureUsage),
        });
      }
    } else {
      // Handle non-billing period time ranges
      // Group usage records by customer and feature
      const usageRecords = await prisma.usageRecord.findMany({
        where: {
          recordedAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(featureId ? { featureId } : {}),
          subscription: {
            ...(customerId ? { organizationId: customerId } : {}),
            status: 'ACTIVE',
          },
        },
        include: {
          feature: true,
          subscription: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Group by customer
      const customerMap: Record<string, any> = {};

      for (const record of usageRecords) {
        const customerId = record.subscription.organization.id;
        const featureId = record.featureId;

        // Initialize customer if not exists
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            id: customerId,
            name: record.subscription.organization.name,
            email: record.subscription.organization.email,
            subscriptionId: record.subscriptionId,
            totalUsage: 0,
            estimatedCost: 0,
            features: {},
          };
        }

        // Initialize feature if not exists
        if (!customerMap[customerId].features[featureId]) {
          customerMap[customerId].features[featureId] = {
            id: featureId,
            name: record.feature.name,
            usage: 0,
            unitName: record.feature.unitName,
          };
        }

        // Add usage
        customerMap[customerId].features[featureId].usage += record.quantity;
        customerMap[customerId].totalUsage += record.quantity;
      }

      // Calculate costs and prepare final customer list
      for (const customerId of Object.keys(customerMap)) {
        // Convert features object to array
        customerMap[customerId].features = Object.values(customerMap[customerId].features);
        
        // Calculate estimated cost (you would use your pricing logic here)
        let customerCost = 0;
        for (const feature of customerMap[customerId].features) {
          // You would apply your pricing tiers here
          // This is a simplified placeholder
          feature.cost = 0; // Calculate actual cost
          customerCost += feature.cost;
        }
        
        customerMap[customerId].estimatedCost = customerCost;
        totalEstimatedCost += customerCost;
      }

      customers = Object.values(customerMap);
      totalUsage = customers.reduce((sum, customer) => sum + customer.totalUsage, 0);
      activeCustomers = customers.length;
    }

    return NextResponse.json({
      totalUsage,
      totalEstimatedCost,
      activeCustomers,
      customers,
      timeRange,
      filters: {
        customerId,
        featureId,
      },
    });
  } catch (error) {
    console.error('Error fetching admin usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
} 