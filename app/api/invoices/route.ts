import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { calculateTax } from '@/lib/utils/tax';
import { requirePermission } from '@/lib/auth/rbac';
import { createInvoice } from '@/lib/services/invoice-service';

// Schema for invoice creation
const createInvoiceSchema = z.object({
  organizationId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(), // Price in cents
    })
  ).min(1),
  dueDate: z.string().datetime().optional(), // ISO string format
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET endpoint to list invoices
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view invoices
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:invoices'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Calculate pagination values
    const skip = (page - 1) * limit;
    
    // Build the query filters
    const where: any = {};
    
    // Only show invoices for organizations the user has access to
    where.organization = {
      userOrganizations: {
        some: {
          userId: session.user.id,
        },
      },
    };
    
    // Apply additional filters if provided
    if (organizationId) {
      where.organizationId = organizationId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    // Get total count for pagination
    const totalCount = await prisma.invoice.count({ where });
    
    // Get invoices with pagination
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      skip,
      take: limit,
    });
    
    return NextResponse.json({
      data: invoices,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error listing invoices:', error);
    return NextResponse.json(
      { error: 'Failed to list invoices' },
      { status: 500 }
    );
  }
}

// POST endpoint to create a new invoice
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage invoices
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:invoices'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Validate request body
    const body = await request.json();
    const validationResult = createInvoiceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { 
      organizationId, 
      customerId, 
      items, 
      dueDate, 
      notes, 
      metadata 
    } = validationResult.data;
    
    // Check if the user belongs to the organization
    const userOrganization = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });
    
    if (!userOrganization) {
      return NextResponse.json(
        { error: 'User does not belong to the specified organization' },
        { status: 403 }
      );
    }
    
    // Create the invoice using our service
    const invoice = await createInvoice({
      organizationId,
      customerId,
      items,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
      metadata,
    });
    
    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
