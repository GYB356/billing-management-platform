import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, taxRateId, startDate, endDate, reason } = await req.json();

    // Validate tax rate exists and belongs to organization
    const taxRate = await prisma.taxRate.findFirst({
      where: {
        id: taxRateId,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxRate) {
      return NextResponse.json(
        { error: 'Tax rate not found' },
        { status: 404 }
      );
    }

    // Validate customer exists and belongs to organization
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: session.user.organizationId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check for existing exemption
    const existingExemption = await prisma.taxExemption.findFirst({
      where: {
        customerId,
        taxRateId,
      },
    });

    if (existingExemption) {
      return NextResponse.json(
        { error: 'Tax exemption already exists for this customer and tax rate' },
        { status: 400 }
      );
    }

    // Create tax exemption
    const taxExemption = await prisma.taxExemption.create({
      data: {
        customerId,
        taxRateId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        reason,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(taxExemption);
  } catch (error) {
    console.error('Error creating tax exemption:', error);
    return NextResponse.json(
      { error: 'Failed to create tax exemption' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const taxRateId = searchParams.get('taxRateId');

    const where = {
      organizationId: session.user.organizationId,
      ...(customerId && { customerId }),
      ...(taxRateId && { taxRateId }),
    };

    const taxExemptions = await prisma.taxExemption.findMany({
      where,
      include: {
        customer: true,
        taxRate: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(taxExemptions);
  } catch (error) {
    console.error('Error fetching tax exemptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax exemptions' },
      { status: 500 }
    );
  }
}