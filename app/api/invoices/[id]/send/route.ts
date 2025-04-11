import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateInvoiceAccess } from '@/lib/validation';
import { sendInvoiceEmail } from '@/lib/email';
import { createEvent } from '@/lib/events';

export async function POST(
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

    const { recipients, message, options = {} } = await request.json();
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new NextResponse('Recipients are required', { status: 400 });
    }

    await sendInvoiceEmail(invoice, recipients, message, options);

    // Log the email sent event
    await createEvent({
      userId: session.user.id,
      organizationId: invoice.organizationId,
      eventType: 'INVOICE_SENT',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        recipients,
        sentAt: new Date().toISOString(),
      },
    });

    // Update invoice status to PENDING if it's in DRAFT
    if (invoice.status === 'DRAFT') {
      await prisma.invoice.update({
        where: { id },
        data: { status: 'PENDING' },
      });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 