import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidateTaxRateCache } from '@/lib/tax-cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rates = await prisma.taxRate.findMany({
      orderBy: [
        { country: 'asc' },
        { region: 'asc' },
      ],
    });

    return NextResponse.json(rates);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax rates' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { country, region, rate } = body;

    // Validate input
    if (!country || rate === undefined || rate < 0 || rate > 1) {
      return NextResponse.json(
        { error: 'Invalid input. Country is required and rate must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Check for existing rate with same country/region
    const existingRate = await prisma.taxRate.findFirst({
      where: {
        country,
        region: region || null,
      },
    });

    if (existingRate) {
      return NextResponse.json(
        { error: 'Tax rate already exists for this country/region' },
        { status: 400 }
      );
    }

    // Create new tax rate
    const newRate = await prisma.taxRate.create({
      data: {
        country,
        region: region || null,
        rate,
        isDefault: false,
      },
    });

    // Invalidate cache for this country/region
    await invalidateTaxRateCache(country, region);

    return NextResponse.json(newRate);
  } catch (error) {
    console.error('Error creating tax rate:', error);
    return NextResponse.json(
      { error: 'Failed to create tax rate' },
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

    const body = await request.json();
    const { id, rate, isDefault } = body;

    if (!id || rate === undefined || rate < 0 || rate > 1) {
      return NextResponse.json(
        { error: 'Invalid input. ID is required and rate must be between 0 and 1' },
        { status: 400 }
      );
    }

    const existingRate = await prisma.taxRate.findUnique({
      where: { id },
    });

    if (!existingRate) {
      return NextResponse.json(
        { error: 'Tax rate not found' },
        { status: 404 }
      );
    }

    const updatedRate = await prisma.taxRate.update({
      where: { id },
      data: {
        rate,
        isDefault: isDefault ?? existingRate.isDefault,
      },
    });

    // Invalidate cache for this country/region
    await invalidateTaxRateCache(existingRate.country, existingRate.region);

    return NextResponse.json(updatedRate);
  } catch (error) {
    console.error('Error updating tax rate:', error);
    return NextResponse.json(
      { error: 'Failed to update tax rate' },
      { status: 500 }
    );
  }
}