import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { checkUsageLimits } from '@/lib/services/usage-service';

// POST endpoint to check usage limits
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view subscriptions
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const subscriptionId = params.id;
    
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
      include: {
        plan: true,
      },
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Get the current billing period dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Check if any limits have been exceeded
    const limitResults = await checkUsageLimits(
      subscriptionId,
      startOfMonth,
      endOfMonth
    );
    
    return NextResponse.json({
      subscriptionId,
      billingPeriod: {
        start: startOfMonth,
        end: endOfMonth,
      },
      limits: limitResults,
    });
  } catch (error: any) {
    console.error('Error checking usage limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check usage limits' },
      { status: 500 }
    );
  }
} 