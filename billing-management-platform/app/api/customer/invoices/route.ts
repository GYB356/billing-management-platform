import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription?.metadata?.stripeCustomerId) {
      return NextResponse.json([]);
    }

    // Get invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.metadata.stripeCustomerId,
      limit: 24, // Last 2 years of monthly invoices
      expand: ['data.charge'],
    });

    // Format the response
    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      date: new Date(invoice.created * 1000).toISOString(),
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      periodStart: new Date(invoice.period_start * 1000).toISOString(),
      periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      metadata: {
        ...invoice.metadata,
        baseAmount: invoice.subtotal,
        tax: invoice.tax,
        taxRate: invoice.tax ? (invoice.tax / invoice.subtotal * 100).toFixed(2) + '%' : '0%',
      },
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
} 