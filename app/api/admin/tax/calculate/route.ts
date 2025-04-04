import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const taxCalculationSchema = z.object({
  amount: z.number().positive(),
  country: z.string().min(2),
  state: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = taxCalculationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { amount, country, state } = validationResult.data;

    // Fetch applicable tax rates from the database
    const taxRate = await prisma.taxRate.findFirst({
      where: {
        country,
        state: state || null,
        isActive: true,
      },
    });

    if (!taxRate) {
      return NextResponse.json({
        error: 'No applicable tax rate found',
      }, { status: 404 });
    }

    // Calculate tax
    const taxAmount = (amount * taxRate.rate) / 100;

    return NextResponse.json({
      success: true,
      taxAmount,
      totalAmount: amount + taxAmount,
      taxRate: taxRate.rate,
    });
  } catch (error) {
    console.error('Error calculating tax:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}