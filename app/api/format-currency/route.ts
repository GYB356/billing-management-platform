import { NextRequest, NextResponse } from 'next/server';
import { CurrencyService } from '@/lib/services/currency-service';
import { z } from 'zod';

const FormatRequestSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  locale: z.string(),
  includeTax: z.boolean().optional(),
  displayCurrency: z.boolean().optional(),
  customFormat: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, locale, ...options } = FormatRequestSchema.parse(body);

    const formatted = await CurrencyService.formatCurrencyForLocale(
      amount,
      currency,
      locale,
      options
    );

    return NextResponse.json({ formatted });
  } catch (error) {
    console.error('Error formatting currency:', error);
    return NextResponse.json(
      { error: 'Failed to format currency' },
      { status: 400 }
    );
  }
}