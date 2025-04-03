import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const taxExemptionSchema = z.object({
  customerId: z.string().optional(),
  taxRateId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxExemption = await prisma.taxExemption.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        taxRate: {
          select: {
            id: true,
            name: true,
            rate: true,
            country: true,
            state: true,
            city: true,
          },
        },
      },
    });

    if (!taxExemption) {
      return NextResponse.json(
        { error: 'Tax exemption not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(taxExemption);
  } catch (error) {
    console.error('Error fetching tax exemption:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = taxExemptionSchema.parse(body);

    // Check if tax exemption exists and belongs to the organization
    const existingExemption = await prisma.taxExemption.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingExemption) {
      return NextResponse.json(
        { error: 'Tax exemption not found' },
        { status: 404 }
      );
    }

    // If customer is being updated, verify it exists and belongs to the organization
    if (validatedData.customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: validatedData.customerId,
          organizationId: session.user.organizationId,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }
    }

    // If tax rate is being updated, verify it exists and belongs to the organization
    if (validatedData.taxRateId) {
      const taxRate = await prisma.taxRate.findFirst({
        where: {
          id: validatedData.taxRateId,
          organizationId: session.user.organizationId,
        },
      });

      if (!taxRate) {
        return NextResponse.json(
          { error: 'Tax rate not found' },
          { status: 404 }
        );
      }
    }

    // Check for overlapping exemptions if dates are being updated
    if (validatedData.startDate || validatedData.endDate) {
      const overlappingExemption = await prisma.taxExemption.findFirst({
        where: {
          id: { not: params.id },
          customerId: validatedData.customerId || existingExemption.customerId,
          taxRateId: validatedData.taxRateId || existingExemption.taxRateId,
          organizationId: session.user.organizationId,
          OR: [
            {
              endDate: null,
              startDate: {
                lte: new Date(
                  validatedData.endDate || existingExemption.endDate || '9999-12-31'
                ),
              },
            },
            {
              AND: [
                { endDate: { not: null } },
                {
                  startDate: {
                    lte: new Date(
                      validatedData.endDate || existingExemption.endDate || '9999-12-31'
                    ),
                  },
                },
                {
                  endDate: {
                    gte: new Date(
                      validatedData.startDate || existingExemption.startDate
                    ),
                  },
                },
              ],
            },
          ],
        },
      });

      if (overlappingExemption) {
        return NextResponse.json(
          { error: 'Overlapping tax exemption exists' },
          { status: 400 }
        );
      }
    }

    const taxExemption = await prisma.taxExemption.update({
      where: {
        id: params.id,
      },
      data: {
        ...validatedData,
        ...(validatedData.startDate && {
          startDate: new Date(validatedData.startDate),
        }),
        ...(validatedData.endDate && {
          endDate: new Date(validatedData.endDate),
        }),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        taxRate: {
          select: {
            id: true,
            name: true,
            rate: true,
            country: true,
            state: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json(taxExemption);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating tax exemption:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if tax exemption exists and belongs to the organization
    const taxExemption = await prisma.taxExemption.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxExemption) {
      return NextResponse.json(
        { error: 'Tax exemption not found' },
        { status: 404 }
      );
    }

    // Check if the tax exemption is being used in any invoices
    const invoiceTax = await prisma.invoiceTax.findFirst({
      where: {
        taxRateId: taxExemption.taxRateId,
        invoice: {
          customerId: taxExemption.customerId,
          createdAt: {
            gte: taxExemption.startDate,
            ...(taxExemption.endDate && {
              lte: taxExemption.endDate,
            }),
          },
        },
      },
    });

    if (invoiceTax) {
      return NextResponse.json(
        { error: 'Cannot delete tax exemption that is being used in invoices' },
        { status: 400 }
      );
    }

    await prisma.taxExemption.delete({
      where: {
        id: params.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting tax exemption:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 