import { NextResponse } from 'next/server';
import { BNPLService } from '@/app/billing/features/financing/bnpl';

const bnplService = new BNPLService(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { customerId, amount, currency } = await request.json();

    // Check eligibility
    const isEligible = await bnplService.checkEligibility(customerId, amount, currency);
    if (!isEligible) {
      return NextResponse.json(
        { error: 'Customer not eligible for financing' },
        { status: 400 }
      );
    }

    // Get financing offers
    const offers = await bnplService.getFinancingOffers(amount, currency);

    return NextResponse.json({ offers });
  } catch (error) {
    console.error('BNPL API error:', error);
    return NextResponse.json(
      { error: 'Failed to process BNPL request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { customerId, offerId, amount, currency } = await request.json();

    const plan = await bnplService.createFinancingPlan(
      customerId,
      offerId,
      amount,
      currency
    );

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('BNPL Plan creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create financing plan' },
      { status: 500 }
    );
  }
} 