import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Stripe } from 'stripe';
import { rateLimit } from '@/lib/rate-limit';
import { 
  listPaymentMethods, 
  addPaymentMethod, 
  updatePaymentMethod,
  deletePaymentMethod 
} from '@/lib/services/payment-method-service';
import { createEvent, EventSeverity } from '@/lib/events';

// Validation schemas
const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  isDefault: z.boolean().optional(),
});

const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  isDefault: z.boolean().optional(),
});

const paginationSchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
});

const deletePaymentMethodSchema = z.object({
  id: z.string(),
});

// Helper function to handle rate limiting
async function checkRateLimit(request: NextRequest) {
  try {
    await rateLimit(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
}

// Helper function to handle Stripe errors
function handleStripeError(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message },
      { status }
    );
  }
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

/**
 * GET /api/payment-methods
 * List payment methods
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate pagination parameters
    const { searchParams } = new URL(request.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No organization or Stripe customer found' },
        { status: 404 }
      );
    }

    const stripeCustomerId = userOrg.organization.stripeCustomerId;

    const paymentMethods = await listPaymentMethods(
      stripeCustomerId, 
      page, 
      limit
    );

    // Log an event
    await createEvent({
      organizationId: userOrg.organizationId,
      eventType: 'payment_methods.viewed',
      resourceType: 'payment_methods',
      resourceId: stripeCustomerId,
      severity: EventSeverity.INFO,
      metadata: {
        userId: session.user.id,
        page,
        limit
      }
    });

    return NextResponse.json(paymentMethods);
  } catch (error) {
    console.error('Error listing payment methods:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters', details: error.errors },
        { status: 400 }
      );
    }
    return handleStripeError(error);
  }
}

/**
 * POST /api/payment-methods
 * Add a payment method
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = addPaymentMethodSchema.parse(body);

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No organization or Stripe customer found' },
        { status: 404 }
      );
    }

    const result = await addPaymentMethod(
      userOrg.organization.stripeCustomerId,
      validatedData.paymentMethodId,
      validatedData.isDefault ?? false,
      userOrg.organizationId
    );

    await createEvent({
      organizationId: userOrg.organizationId,
      eventType: 'payment_methods.added',
      resourceType: 'payment_methods',
      resourceId: validatedData.paymentMethodId,
      severity: EventSeverity.INFO,
      metadata: { userId: session.user.id }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error adding payment method:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payment method data', details: error.errors },
        { status: 400 }
      );
    }
    return handleStripeError(error);
  }
}

/**
 * PATCH /api/payment-methods
 * Update a payment method
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updatePaymentMethodSchema.parse(body);

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No organization or Stripe customer found' },
        { status: 404 }
      );
    }

    const result = await updatePaymentMethod(
      userOrg.organization.stripeCustomerId,
      validatedData.paymentMethodId,
      validatedData.isDefault?.toString()
    );

    await createEvent({
      organizationId: userOrg.organizationId,
      eventType: 'payment_methods.updated',
      resourceType: 'payment_methods',
      resourceId: validatedData.paymentMethodId,
      severity: EventSeverity.INFO,
      metadata: { userId: session.user.id }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating payment method:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payment method data', details: error.errors },
        { status: 400 }
      );
    }
    return handleStripeError(error);
  }
}

/**
 * DELETE /api/payment-methods
 * Delete a payment method
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { id: paymentMethodId } = deletePaymentMethodSchema.parse({
      id: searchParams.get('id')
    });

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
    return NextResponse.json(
        { error: 'No organization or Stripe customer found' },
        { status: 404 }
      );
    }

    await deletePaymentMethod(
      userOrg.organization.stripeCustomerId,
      paymentMethodId
    );

    await createEvent({
      organizationId: userOrg.organizationId,
      eventType: 'payment_methods.deleted',
      resourceType: 'payment_methods',
      resourceId: paymentMethodId,
      severity: EventSeverity.INFO,
      metadata: { userId: session.user.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payment method ID', details: error.errors },
        { status: 400 }
      );
    }
    return handleStripeError(error);
  }
} 