import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateInvoiceAccess } from '@/lib/validation';
import { generateInvoicePDF } from '@/lib/pdf';
import { createEvent } from '@/lib/events';

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

    // Get template options from query params
    const searchParams = request.nextUrl.searchParams;
    const options = {
      theme: searchParams.get('theme') || 'light',
      showTaxDetails: searchParams.get('showTaxDetails') !== 'false',
      showExchangeRate: searchParams.get('showExchangeRate') !== 'false',
      currency: searchParams.get('currency') || invoice.currency,
      language: searchParams.get('language') || 'en',
    };

    const pdfBuffer = await generateInvoicePDF(invoice, options);

    // Log the download event
    await createEvent({
      userId: session.user.id,
      organizationId: invoice.organizationId,
      eventType: 'INVOICE_DOWNLOADED',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        downloadedAt: new Date().toISOString(),
        options,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error downloading invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Custom template download endpoint
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

    // Get custom template options from request body
    const options = await request.json();
    const pdfBuffer = await generateInvoicePDF(invoice, options);

    // Log the custom download event
    await createEvent({
      userId: session.user.id,
      organizationId: invoice.organizationId,
      eventType: 'INVOICE_DOWNLOADED_CUSTOM',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        downloadedAt: new Date().toISOString(),
        customTemplate: true,
        options,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}-custom.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating custom invoice PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}