import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoiceGenerator } from '@/lib/invoice-generator';
import { createEvent } from '@/lib/events';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        organization: true,
        subscription: {
          include: {
            organization: true,
          }
        },
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Verify that the user has access to this invoice
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: session.user.id,
        organizationId: invoice.organizationId,
      },
    });

    if (userOrganizations.length === 0 && session.user.role !== 'ADMIN') {
      return new NextResponse('Access denied', { status: 403 });
    }

    // Get template options from query params
    const theme = request.nextUrl.searchParams.get('theme') || 'light';
    const showTaxDetails = request.nextUrl.searchParams.get('showTaxDetails') !== 'false';
    const showExchangeRate = request.nextUrl.searchParams.get('showExchangeRate') !== 'false';
    const currency = request.nextUrl.searchParams.get('currency') || invoice.currency;
    
    // Generate the PDF
    const pdfBuffer = await InvoiceGenerator.generateInvoicePDF(invoice.id, {
      theme,
      showTaxDetails,
      showExchangeRate,
      currencyOptions: {
        showOriginalCurrency: true,
        showConversionRate: currency !== invoice.currency,
        showInMultipleCurrencies: currency !== invoice.currency,
        displayCurrencies: currency !== invoice.currency ? [invoice.currency, currency] : [invoice.currency],
      },
      customizableSections: {
        showBankDetails: true,
        showTermsAndConditions: true,
      },
    });

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
      },
    });

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        organization: true,
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Verify access permissions
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: session.user.id,
        organizationId: invoice.organizationId,
      },
    });

    if (userOrganizations.length === 0 && session.user.role !== 'ADMIN') {
      return new NextResponse('Access denied', { status: 403 });
    }

    // Get template options from request body
    const options = await request.json();

    // Generate the PDF with custom options
    const pdfBuffer = await InvoiceGenerator.generateInvoicePDF(invoice.id, options);

    // Log the download event with custom template
    await createEvent({
      userId: session.user.id,
      organizationId: invoice.organizationId,
      eventType: 'INVOICE_DOWNLOADED_CUSTOM',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        customTemplate: true,
        options: JSON.stringify(options),
        downloadedAt: new Date().toISOString(),
      },
    });

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating custom invoice PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 