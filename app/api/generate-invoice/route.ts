import { NextRequest, NextResponse } from 'next/server';
import { LocalizedInvoiceService } from '@/lib/services/localized-invoice-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const InvoiceGenerationRequestSchema = z.object({
  invoiceData: z.object({
    id: z.string(),
    amounts: z.object({
      subtotal: z.number(),
      tax: z.number().optional(),
      total: z.number(),
    }),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      amount: z.number(),
    })),
    customer: z.object({
      id: z.string(),
      type: z.enum(['business', 'individual']),
      country: z.string(),
      taxExempt: z.boolean().optional(),
    }),
  }),
  language: z.string().optional(),
  currency: z.string().optional(),
  template: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceData, ...options } = InvoiceGenerationRequestSchema.parse(body);

    // Get organization details for invoice generation
    const organization = await prisma.organization.findFirst({
      where: { id: session.user.organizationId },
      include: {
        settings: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const pdfBuffer = await LocalizedInvoiceService.generateInvoice(
      invoiceData,
      organization,
      {
        language: options.language || organization.settings?.defaultLanguage,
        currency: options.currency || organization.settings?.defaultCurrency,
        template: options.template,
      }
    );

    // Create invoice record in database
    await prisma.invoice.update({
      where: { id: invoiceData.id },
      data: {
        status: 'GENERATED',
        metadata: {
          language: options.language,
          currency: options.currency,
          template: options.template,
        },
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 400 }
    );
  }
}