import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listPaymentMethods } from '@/lib/services/payment-method-service';
import { createEvent, EventSeverity } from '@/lib/events';

/**
 * GET /api/payment-methods
 * List all payment methods for the current organization
 */
export async function GET(request: NextRequest) {
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
    const paymentMethods = await listPaymentMethods(stripeCustomerId);

    // Log an event
    await createEvent({
      organizationId: userOrg.organizationId,
      userId: session.user.id,
      eventType: 'payment_methods.viewed',
      resourceType: 'payment_methods',
      resourceId: stripeCustomerId,
      severity: EventSeverity.INFO,
    });

    return NextResponse.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
} 