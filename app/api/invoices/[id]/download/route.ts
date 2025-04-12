import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
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
=======
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoiceGenerator } from '@/lib/invoice-generator';
import { createEvent } from '@/lib/events';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

<<<<<<< HEAD
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
=======
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

<<<<<<< HEAD
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
=======
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
    const theme = req.nextUrl.searchParams.get('theme') || 'light';
    const showTaxDetails = req.nextUrl.searchParams.get('showTaxDetails') !== 'false';
    const showExchangeRate = req.nextUrl.searchParams.get('showExchangeRate') !== 'false';
    const currency = req.nextUrl.searchParams.get('currency') || invoice.currency;
    
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

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
<<<<<<< HEAD
        options,
      },
    });

=======
      },
    });

    // Return the PDF with appropriate headers
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
<<<<<<< HEAD
    console.error('Error downloading invoice:', error);
=======
    console.error('Error generating invoice PDF:', error);
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

<<<<<<< HEAD
// Custom template download endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
=======
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

<<<<<<< HEAD
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
=======
    // Get the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        organization: true,
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

<<<<<<< HEAD
    // Get custom template options from request body
    const options = await request.json();
    const pdfBuffer = await generateInvoicePDF(invoice, options);

    // Log the custom download event
=======
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
    const options = await req.json();

    // Generate the PDF with custom options
    const pdfBuffer = await InvoiceGenerator.generateInvoicePDF(invoice.id, options);

    // Log the download event with custom template
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    await createEvent({
      userId: session.user.id,
      organizationId: invoice.organizationId,
      eventType: 'INVOICE_DOWNLOADED_CUSTOM',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
<<<<<<< HEAD
        downloadedAt: new Date().toISOString(),
        customTemplate: true,
        options,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}-custom.pdf"`,
=======
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });
  } catch (error) {
    console.error('Error generating custom invoice PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}