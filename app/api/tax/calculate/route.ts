import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaxService } from '@/lib/services/tax-service';
import { createEvent } from '@/lib/events';
import { z } from 'zod';

const calculateTaxSchema = z.object({
  amount: z.number().positive(),
  countryCode: z.string().length(2),
  stateCode: z.string().optional(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']),
  vatNumber: z.string().optional(),
  productType: z.string().optional(),
  currency: z.string().length(3)
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = calculateTaxSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { id: session.user.organizationId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Calculate tax
    const taxService = new TaxService();
    const result = await taxService.calculateTax({
      amount: data.amount,
      countryCode: data.countryCode,
      stateCode: data.stateCode,
      customerType: data.customerType,
      vatNumber: data.vatNumber,
      productType: data.productType
    });

    // Log tax calculation
    await createEvent({
      type: 'TAX_CALCULATION',
      resourceType: 'TAX',
      resourceId: organization.id,
      metadata: {
        input: data,
        result: {
          taxAmount: result.taxAmount,
          taxRate: result.taxRate,
          breakdown: result.breakdown
        }
      }
    });

    return NextResponse.json({
      success: true,
      ...result,
      currency: data.currency
    });
  } catch (error) {
    console.error('Error calculating tax:', error);
    
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}