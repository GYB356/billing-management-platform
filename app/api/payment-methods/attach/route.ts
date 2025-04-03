import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { addPaymentMethod } from '@/lib/services/payment-method-service';
import { createEvent, EventSeverity } from '@/lib/events';
import { z } from 'zod';

// Zod schema for request validation
const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  setAsDefault: z.boolean().optional().default(false),
});

/**
 * POST /api/payment-methods/attach
 * Attach a payment method to the current organization
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

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = attachPaymentMethodSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { paymentMethodId, setAsDefault } = validationResult.data;
    
    // Add the payment method
    const stripeCustomerId = userOrg.organization.stripeCustomerId;
    const paymentMethod = await addPaymentMethod(
      stripeCustomerId,
      paymentMethodId,
      setAsDefault,
      userOrg.organizationId
    );

    return NextResponse.json(paymentMethod);
  } catch (error) {
    console.error('Error attaching payment method:', error);
    return NextResponse.json(
      { error: 'Failed to attach payment method' },
      { status: 500 }
    );
  }
} 