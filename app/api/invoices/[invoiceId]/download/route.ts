import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoiceService } from '@/lib/invoice';

interface RouteParams {
  params: {
    invoiceId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = params;
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the invoice to check access rights
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if user has access to the invoice
    if (session.user.role !== 'ADMIN') {
      const userHasAccess = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId: invoice.organizationId,
        },
      });

      if (!userHasAccess) {
        return NextResponse.json({ error: 'Unauthorized to access this invoice' }, { status: 403 });
      }
    }

    // Check if there are template options in the request
    const templateOptions = req.nextUrl.searchParams.get('templateOptions')
      ? JSON.parse(req.nextUrl.searchParams.get('templateOptions')!)
      : {};

    // Generate PDF
    const pdfBuffer = await InvoiceService.generateInvoice(invoiceId, templateOptions);

    // Log download event
    await prisma.event.create({
      data: {
        eventType: 'INVOICE_DOWNLOADED',
        resourceType: 'INVOICE',
        resourceId: invoiceId,
        createdById: session.user.id,
        metadata: {
          invoiceNumber: invoice.number,
          organizationId: invoice.organizationId,
        },
      },
    });

    // Set response headers and return PDF
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="invoice-${invoice.number}.pdf"`);
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error downloading invoice:', error);
    return NextResponse.json({ error: 'Failed to download invoice' }, { status: 500 });
  }
} 