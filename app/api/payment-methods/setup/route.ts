import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createSetupIntent } from '@/lib/services/payment-method-service';
import { createEvent, EventSeverity } from '@/lib/events';

/**
 * POST /api/payment-methods/setup
 * Create a setup intent for adding a new payment method
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current user and check auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user's organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No organization or Stripe customer found' },
        { status: 404 }
      );
    }

    const stripeCustomerId = userOrg.organization.stripeCustomerId;
    const setupIntent = await createSetupIntent(stripeCustomerId);

    // Log an event
    await createEvent({
      organizationId: userOrg.organizationId,
      userId: session.user.id,
      eventType: 'payment_method.setup_initiated',
      resourceType: 'payment_method',
      resourceId: setupIntent.id,
      severity: EventSeverity.INFO,
      metadata: {
        setupIntentId: setupIntent.id,
      },
    });

    return NextResponse.json(setupIntent);
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    );
  }
} 