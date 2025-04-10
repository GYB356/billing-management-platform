import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createTaxRateHistory } from '@/lib/utils/tax-history';

const taxRateSchema = z.object({
  name: z.string(),
  rate: z.number().min(0).max(100),
  country: z.string(),
  state: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country');
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const isActive = searchParams.get('isActive') === 'true';

    const where = {
      organizationId: session.user.organizationId,
      ...(country && { country }),
      ...(state && { state }),
      ...(city && { city }),
      ...(isActive !== undefined && { isActive }),
    };

    const taxRates = await prisma.taxRate.findMany({
      where,
      orderBy: [
        { country: 'asc' },
        { state: 'asc' },
        { city: 'asc' },
        { rate: 'desc' },
      ],
    });

    return NextResponse.json(taxRates);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = taxRateSchema.parse(body);

    // Check if a tax rate already exists for this location
    const existingTaxRate = await prisma.taxRate.findFirst({
      where: {
        organizationId: session.user.organizationId,
        country: validatedData.country,
        state: validatedData.state || null,
        city: validatedData.city || null,
      },
    });

    if (existingTaxRate) {
      return NextResponse.json(
        { error: 'Tax rate already exists for this location' },
        { status: 400 }
      );
    }

    const taxRate = await prisma.taxRate.create({
      data: {
        ...validatedData,
        organizationId: session.user.organizationId,
      },
    });

    // Create history entry
    await createTaxRateHistory({
      taxRate,
      changedBy: session.user.id,
      reason: 'Tax rate created',
    });

    return NextResponse.json(taxRate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating tax rate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 