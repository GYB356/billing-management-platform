import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

// Validation schemas
const createSubscriptionSchema = z.object({
  planId: z.string(),
  organizationId: z.string(),
  paymentMethodId: z.string().optional(),
  trialDays: z.number().optional(),
});

const updateSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  planId: z.string().optional(),
  quantity: z.number().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = createSubscriptionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { planId, organizationId, paymentMethodId, trialDays } = validation.data;

    // Get organization and plan
    const [organization, plan] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.plan.findUnique({ where: { id: planId } })
    ]);

    if (!organization || !plan) {
      return NextResponse.json(
        { error: 'Organization or plan not found' },
        { status: 404 }
      );
    }

    // Create or get Stripe customer
    let stripeCustomerId = organization.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: organization.email,
        metadata: { organizationId }
      });
      stripeCustomerId = customer.id;

      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId }
      });
    }

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_period_days: trialDays,
      expand: ['latest_invoice.payment_intent'],
    });

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
    });

    return NextResponse.json({
      subscription,
      clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateSubscriptionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { subscriptionId, planId, quantity, cancelAtPeriodEnd } = validation.data;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { organization: true }
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }

      await stripe.subscriptions.update(subscription.stripeSubscriptionId!, {
        items: [{ price: plan.stripePriceId }],
        proration_behavior: 'create_prorations',
      });
    }

    if (typeof quantity === 'number') {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId!, {
        quantity,
      });
    }

    if (typeof cancelAtPeriodEnd === 'boolean') {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId!, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: planId || undefined,
        quantity: quantity || undefined,
        cancelAtPeriodEnd: cancelAtPeriodEnd || undefined,
      },
    });

    return NextResponse.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { organizationId },
      include: {
        plan: true,
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
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