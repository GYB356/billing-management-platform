import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscription: true,
      },
    });

    if (!user?.subscription?.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: user.subscription.stripeCustomerId,
      limit: 12,
      expand: ['data.hosted_invoice_url'],
    });

    return NextResponse.json({
      invoices: invoices.data.map((invoice) => ({
        id: invoice.number,
        amount: invoice.amount_paid / 100,
        status: invoice.status,
        created: new Date(invoice.created * 1000),
        pdfUrl: invoice.hosted_invoice_url,
      })),
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Error fetching invoices' },
      { status: 500 }
    );
  }
} 