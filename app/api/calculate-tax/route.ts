import { NextRequest, NextResponse } from 'next/server';
import { LocalizedInvoiceService } from '@/lib/services/localized-invoice-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const TaxCalculationRequestSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  locale: z.string(),
  customerType: z.enum(['business', 'individual']).optional(),
  customerCountry: z.string().optional(),
  productType: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = TaxCalculationRequestSchema.parse(body);

    // Get organization details for tax calculation
    const organization = await prisma.organization.findFirst({
      where: { id: session.user.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const taxResult = await LocalizedInvoiceService.calculateTax(
      data.amount,
      organization,
      {
        type: data.customerType || 'individual',
        country: data.customerCountry || organization.country,
        sameCountry: data.customerCountry === organization.country,
        taxExempt: false,
      }
    );

    return NextResponse.json(taxResult);
  } catch (error) {
    console.error('Error calculating tax:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 400 }
    );
  }
}