import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createInvoice, finalizeInvoice, markInvoiceAsPaid, voidInvoice } from '@/lib/billing/invoice';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const invoiceId = searchParams.get('id');

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          subscription: {
            include: {
              plan: true,
            },
          },
          paymentMethod: true,
          taxRates: {
            include: {
              taxRate: true,
            },
          },
          transactions: true,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json(invoice);
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        customer: {
          userId: session.user.id,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        customer: true,
        subscription: true,
        taxRates: {
          include: {
            taxRate: true,
          },
        },
      },
    });

    const total = await prisma.invoice.count({
      where: {
        customer: {
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({ invoices, total });
  } catch (error) {
    console.error('Invoices fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const invoice = await createInvoice(data);

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('id');
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    const data = await request.json();
    let invoice;

    switch (data.action) {
      case 'finalize':
        invoice = await finalizeInvoice(invoiceId);
        break;
      case 'mark_paid':
        invoice = await markInvoiceAsPaid(
          invoiceId,
          data.paymentMethodId,
          data.paymentIntentId,
          data.receiptUrl
        );
        break;
      case 'void':
        invoice = await voidInvoice(invoiceId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Invoice update error:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
