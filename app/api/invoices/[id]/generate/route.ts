import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InvoiceService } from '@/lib/invoice';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const invoiceId = params.id;
    const body = await request.json();

    // Verify user has access to this invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Check if user has access to this invoice
    const userOrganization = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId: invoice.subscription.organizationId,
      },
    });

    if (!userOrganization) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Generate invoice with custom template
    const pdfBuffer = await InvoiceService.generateInvoice(invoiceId, body);

    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 