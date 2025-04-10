import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { 
  removePaymentMethod, 
  setDefaultPaymentMethod 
} from '@/lib/services/payment-method-service';

/**
 * DELETE /api/payment-methods/[id]
 * Remove a payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentMethodId = params.id;

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

    // Remove the payment method
    const stripeCustomerId = userOrg.organization.stripeCustomerId;
    await removePaymentMethod(
      stripeCustomerId,
      paymentMethodId,
      userOrg.organizationId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing payment method:', error);
    return NextResponse.json(
      { error: 'Failed to remove payment method' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payment-methods/[id]
 * Update a payment method (currently only supports setting as default)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentMethodId = params.id;

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

    // Parse the request body
    const body = await request.json();
    
    // Set as default if requested
    if (body.setAsDefault) {
      const stripeCustomerId = userOrg.organization.stripeCustomerId;
      const paymentMethod = await setDefaultPaymentMethod(
        stripeCustomerId,
        paymentMethodId,
        userOrg.organizationId
      );
      
      return NextResponse.json(paymentMethod);
    }

    return NextResponse.json(
      { error: 'No valid operation specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    );
  }
} 