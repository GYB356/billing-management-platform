import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            organization: true,
            plan: true,
          },
        },
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Check if user has permission to pay this invoice
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId: invoice.subscription.organizationId,
      },
    });

    if (!userOrg) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: invoice.currency,
            product_data: {
              name: `${invoice.subscription.plan.name} Subscription`,
            },
            unit_amount: Math.round(invoice.totalAmount), // Already in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?canceled=true`,
      metadata: {
        invoiceId,
        subscriptionId: invoice.subscriptionId,
        organizationId: invoice.subscription.organizationId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating payment session:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 