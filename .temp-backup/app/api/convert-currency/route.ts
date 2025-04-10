import { NextRequest, NextResponse } from 'next/server';
import { CurrencyService } from '@/lib/services/currency-service';
import { z } from 'zod';

const ConversionRequestSchema = z.object({
  amount: z.number(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  includeDetails: z.boolean().optional(),
  roundingMode: z.enum(['ceil', 'floor', 'round']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = ConversionRequestSchema.parse(body);

    const result = await CurrencyService.convertCurrency(
      data.amount,
      data.fromCurrency,
      data.toCurrency,
      {
        includeDetails: data.includeDetails,
        roundingMode: data.roundingMode,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { error: 'Failed to convert currency' },
      { status: 400 }
    );
  }
}