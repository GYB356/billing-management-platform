import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CurrencyService } from '@/lib/services/currency-service';

const PreferenceUpdateSchema = z.object({
  currency: z.string(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currency } = PreferenceUpdateSchema.parse(body);

    // Validate currency is supported
    if (!CurrencyService.currencies.some(c => c.code === currency.toUpperCase())) {
      return NextResponse.json(
        { error: 'Unsupported currency' },
        { status: 400 }
      );
    }

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preference: {
          upsert: {
            create: { currency },
            update: { currency },
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating currency preference:', error);
    return NextResponse.json(
      { error: 'Failed to update currency preference' },
      { status: 400 }
    );
  }
}