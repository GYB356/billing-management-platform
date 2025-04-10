import { NextResponse } from 'next/server';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const subscriptionService = new SubscriptionService();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { organizationId, planId, priceId, paymentMethodId, couponCode, taxRateIds, metadata, trialDays } = await request.json();
    
    if (!organizationId || !planId || !priceId || !paymentMethodId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const result = await subscriptionService.createSubscription({
      organizationId,
      userId: session.user.id,
      planId,
      priceId,
      paymentMethodId,
      couponId: couponCode,
      taxRateIds,
      metadata,
      trialDays,
    });
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json(result.requiresAction ? {
      requiresAction: true,
      clientSecret: result.clientSecret,
    } : {
      success: true,
      subscription: result.subscription,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }
    
    const subscription = await subscriptionService.getSubscriptionWithDetails(organizationId);
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({
      subscription,
      invoices: subscription.invoices,
      usageRecords: subscription.usageRecords,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, subscriptionId, updates } = await request.json();

    if (!organizationId || !subscriptionId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await subscriptionService.updateSubscription({
      organizationId,
      subscriptionId,
      updates,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, subscription: result.subscription });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update subscription' }, { status: 500 });
  }
}