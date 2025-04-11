import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTaxRateHistory } from '@/lib/utils/tax-history';
import { validateTaxRate, validateTaxRateOverlap, validateTaxRateHistory } from '@/lib/validation/tax';

const taxRateSchema = z.object({
  name: z.string().optional(),
  rate: z.number().min(0).max(100).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxRate = await prisma.taxRate.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxRate) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    return NextResponse.json(taxRate);
  } catch (error) {
    console.error('Error fetching tax rate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax rate' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxRate = await prisma.taxRate.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxRate) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    const data = await request.json();

    // Validate the update
    const validationErrors = await validateTaxRate(data, session.user.organizationId);
    if (validationErrors.length > 0) {
      return NextResponse.json({ errors: validationErrors }, { status: 400 });
    }

    // Check for overlapping tax rates
    const overlapError = await validateTaxRateOverlap(
      { ...taxRate, ...data },
      session.user.organizationId
    );
    if (overlapError) {
      return NextResponse.json({ error: overlapError }, { status: 400 });
    }

    // Check historical conflicts
    const historyError = await validateTaxRateHistory(
      { ...taxRate, ...data },
      session.user.organizationId
    );
    if (historyError) {
      return NextResponse.json({ error: historyError }, { status: 400 });
    }

    // Update the tax rate
    const updatedTaxRate = await prisma.taxRate.update({
      where: { id: params.id },
      data,
    });

    // Create history entry
    await createTaxRateHistory(
      updatedTaxRate,
      session.user.id,
      'Tax rate updated'
    );

    return NextResponse.json(updatedTaxRate);
  } catch (error) {
    console.error('Error updating tax rate:', error);
    return NextResponse.json(
      { error: 'Failed to update tax rate' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxRate = await prisma.taxRate.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxRate) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    // Validate deletion
    const validationError = await validateTaxRateDeletion(
      taxRate,
      session.user.organizationId
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Create history entry before deletion
    await createTaxRateHistory(
      taxRate,
      session.user.id,
      'Tax rate deleted'
    );

    // Delete the tax rate
    await prisma.taxRate.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tax rate:', error);
    return NextResponse.json(
      { error: 'Failed to delete tax rate' },
      { status: 500 }
    );
  }
}