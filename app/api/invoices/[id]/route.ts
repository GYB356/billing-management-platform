import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { validateInvoiceAccess } from '@/lib/validation';
import { InvoiceStatus } from '@prisma/client';

const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['PAID', 'CANCELLED', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PAID', 'CANCELLED'],
  CANCELLED: [],
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const updateData = await request.json();

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Validate status transition if status is being updated
    if (
      updateData.status &&
      !allowedTransitions[invoice.status].includes(updateData.status)
    ) {
      return new NextResponse(
        `Invalid status transition from ${invoice.status} to ${updateData.status}`,
        { status: 400 }
      );
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
      },
    });

    // If the invoice is connected to Stripe, update it there as well
    if (invoice.stripeInvoiceId) {
      try {
        await stripe.invoices.update(invoice.stripeInvoiceId, {
          description: updateData.description,
          // Add other Stripe-specific updates as needed
        });
      } catch (error) {
        console.error('Error updating Stripe invoice:', error);
        // Don't fail the request if Stripe update fails
      }
    }

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // If the invoice is connected to Stripe, delete it there first
    if (invoice.stripeInvoiceId) {
      try {
        await stripe.invoices.del(invoice.stripeInvoiceId);
      } catch (error) {
        console.error('Error deleting Stripe invoice:', error);
        // Don't fail the request if Stripe deletion fails
      }
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}