import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for metadata update
const updateMetadataSchema = z.object({
  metadata: z.record(z.string(), z.any()),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view customers
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
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
      select: {
        id: true,
        metadata: true,
      },
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ metadata: customer.metadata || {} });
  } catch (error: any) {
    console.error('Error retrieving customer metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve customer metadata' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage customers
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = updateMetadataSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { metadata } = validationResult.data;
    
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
    
    // Update customer metadata
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        metadata: {
          ...(customer.metadata as Record<string, any> || {}),
          ...metadata,
        },
      },
      select: {
        id: true,
        metadata: true,
      },
    });
    
    return NextResponse.json({ metadata: updatedCustomer.metadata });
  } catch (error: any) {
    console.error('Error updating customer metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update customer metadata' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage customers
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const customerId = params.id;
    
    // Get key to delete from query params
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
    }
    
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
    
    // Remove key from metadata
    const metadata = { ...(customer.metadata as Record<string, any> || {}) };
    delete metadata[key];
    
    // Update customer metadata
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        metadata,
      },
      select: {
        id: true,
        metadata: true,
      },
    });
    
    return NextResponse.json({ metadata: updatedCustomer.metadata });
  } catch (error: any) {
    console.error('Error deleting customer metadata key:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete customer metadata key' },
      { status: 500 }
    );
  }
} 