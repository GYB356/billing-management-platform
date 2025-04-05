import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { addCredit, deductCredit, getCreditHistory } from '@/lib/services/credit-service';
import { z } from 'zod';

// Schema validation for credit adjustment
const creditAdjustmentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET endpoint to retrieve credit history
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const types = searchParams.getAll('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    
    // Check if the customer exists and user has access
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Get credit history
    const creditHistory = await getCreditHistory(customerId, {
      limit,
      offset: (page - 1) * limit,
      types: types.length > 0 ? types : undefined,
      startDate,
      endDate,
    });
    
    return NextResponse.json({
      currentBalance: customer.creditBalance,
      ...creditHistory,
      meta: {
        ...creditHistory.meta,
        page,
        totalPages: Math.ceil(creditHistory.meta.total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error retrieving credit history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve credit history' },
      { status: 500 }
    );
  }
}

// POST endpoint to add credit
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = creditAdjustmentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { amount, description, reason, metadata } = validationResult.data;
    
    // Check if the customer exists and user has access
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Add credit to the customer
    const result = await addCredit({
      customerId,
      organizationId: customer.organizationId,
      amount,
      description,
      reason,
      metadata,
      adjustedById: session.user.id,
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error adding credit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add credit' },
      { status: 500 }
    );
  }
}

// PUT endpoint to deduct credit
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = creditAdjustmentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { amount, description, reason, metadata } = validationResult.data;
    
    // Check if the customer exists and user has access
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Deduct credit from the customer
    const result = await deductCredit({
      customerId,
      organizationId: customer.organizationId,
      amount,
      description,
      reason,
      metadata,
      adjustedById: session.user.id,
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deducting credit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deduct credit' },
      { status: 500 }
    );
  }
} 