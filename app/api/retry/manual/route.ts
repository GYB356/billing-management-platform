import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the invoice from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceId);
    
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { message: 'Invoice is already paid' },
        { status: 200 }
      );
    }

    // Attempt to pay the invoice
    const result = await stripe.invoices.pay(invoiceId);

    // Create a retry log
    await prisma.retryLog.create({
      data: {
        invoiceId,
        userId: invoice.customer?.toString() || 'unknown',
        status: result.status,
        attempts: 1,
      },
    });

    return NextResponse.json({
      message: 'Invoice retry initiated successfully',
      status: result.status,
    });
  } catch (error: any) {
    console.error('Failed to retry invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retry invoice' },
      { status: 500 }
    );
  }
} 