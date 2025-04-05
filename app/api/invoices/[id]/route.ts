import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const invoiceId = params.id;
    
    // Get invoice with related data
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        items: true,
        customer: true,
        subscription: true,
        taxes: true,
      },
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Error retrieving invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve invoice' },
      { status: 500 }
    );
  }
}

// Implement PATCH method to update invoice
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const invoiceId = params.id;
    const data = await request.json();
    
    // Check if invoice exists and belongs to user's organization
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Check if invoice is in DRAFT status (only draft invoices can be updated)
    if (existingInvoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be updated' },
        { status: 400 }
      );
    }
    
    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        dueDate: data.dueDate,
        notes: data.notes,
        customerId: data.customerId,
        // Only update items if provided
        ...(data.items && {
          items: {
            deleteMany: {},
            createMany: {
              data: data.items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            },
          },
        }),
      },
      include: {
        items: true,
        customer: true,
      },
    });
    
    return NextResponse.json(updatedInvoice);
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// Implement DELETE method for draft invoices
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const invoiceId = params.id;
    
    // Check if invoice exists and belongs to user's organization
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Check if invoice is in DRAFT status (only draft invoices can be deleted)
    if (existingInvoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted' },
        { status: 400 }
      );
    }
    
    // Delete invoice items first
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId },
    });
    
    // Delete invoice
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}