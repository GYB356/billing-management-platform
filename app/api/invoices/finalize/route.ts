import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateInvoiceAccess } from '@/lib/validation';
import { createEvent } from '@/lib/events';

export async function POST(
  request: NextRequest
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { invoiceIds } = await request.json();
    
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return new NextResponse('Invoice IDs are required', { status: 400 });
    }

    // Verify access for all invoices
    for (const id of invoiceIds) {
      const hasAccess = await validateInvoiceAccess(session, id);
      if (!hasAccess) {
        return new NextResponse(`Unauthorized access to invoice ${id}`, { status: 401 });
      }
    }

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        status: 'DRAFT',
      },
    });

    if (invoices.length !== invoiceIds.length) {
      return new NextResponse('Some invoices were not found or are not in DRAFT status', { status: 400 });
    }

    // Update all invoices to PENDING
    const updatedInvoices = await prisma.$transaction(
      invoices.map((invoice) =>
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { 
            status: 'PENDING',
            finalizedAt: new Date(),
          },
        })
      )
    );

    // Log events for each finalized invoice
    await Promise.all(
      updatedInvoices.map((invoice) =>
        createEvent({
          userId: session.user.id,
          organizationId: invoice.organizationId,
          eventType: 'INVOICE_FINALIZED',
          resourceType: 'INVOICE',
          resourceId: invoice.id,
          metadata: {
            invoiceNumber: invoice.number,
            finalizedAt: invoice.finalizedAt?.toISOString(),
          },
        })
      )
    );

    return NextResponse.json(updatedInvoices);
  } catch (error) {
    console.error('Error finalizing invoices:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 