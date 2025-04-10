import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

interface RouteParams {
  params: {
    id: string; // Changed from invoiceId to id
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params; // Changed from invoiceId to id
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get invoice with related data
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            taxId: true,
          },
        },
        subscription: {
          select: {
            id: true,
            name: true,
            planId: true,
            plan: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: true,
      },
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Check access rights for non-admin users
    if (session.user.role !== 'ADMIN') {
      // Check if user belongs to the organization this invoice is for
      const userOrganization = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId: invoice.organizationId,
        },
      });
      
      if (!userOrganization) {
        return NextResponse.json({ error: 'Unauthorized to access this invoice' }, { status: 403 });
      }
    }
    
    return NextResponse.json(invoice);
    
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch invoice', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params; // Changed from invoiceId to id
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only allow admins to update invoices
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can update invoices' }, { status: 403 });
    }
    
    // Find the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Parse request body
    const requestData = await req.json();
    
    // Define update schema based on allowed fields
    const updateInvoiceSchema = z.object({
      // Allow updating status with transition rules
      status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
      
      // Basic invoice details that can be updated
      notes: z.string().optional(),
      dueDate: z.string().datetime().optional(),
      
      // For draft invoices, allow updating more fields
      items: z.array(
        z.object({
          id: z.string().optional(),
          description: z.string(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative(),
          taxRate: z.number().nonnegative().optional(),
        })
      ).optional(),
      
      // Additional fields
      paymentTerms: z.string().optional(),
      paymentInstructions: z.string().optional(),
    });
    
    const validationResult = updateInvoiceSchema.safeParse(requestData);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: validationResult.error.format() 
      }, { status: 400 });
    }
    
    const updateData = validationResult.data;
    
    // Status transition validation
    if (updateData.status) {
      // Define allowed transitions
      const allowedTransitions: Record<string, string[]> = {
        'DRAFT': ['SENT', 'CANCELLED'],
        'SENT': ['PAID', 'OVERDUE', 'CANCELLED'],
        'OVERDUE': ['PAID', 'CANCELLED'],
        'PAID': [], // No transitions from PAID
        'CANCELLED': ['DRAFT'], // Allow reopening as draft
      };
      
      if (!allowedTransitions[invoice.status].includes(updateData.status) && 
          updateData.status !== invoice.status) {
        return NextResponse.json({ 
          error: `Cannot transition invoice from ${invoice.status} to ${updateData.status}` 
        }, { status: 400 });
      }
      
      // Special handling for PAID status
      if (updateData.status === 'PAID' && invoice.status !== 'PAID') {
        updateData.paidAt = new Date().toISOString();
      }
    }
    
    // For draft invoices, allow updating items
    let itemsToCreate: any[] = [];
    let itemsToUpdate: any[] = [];
    let itemIds: string[] = [];
    
    if (updateData.items && invoice.status === 'DRAFT') {
      let totalAmount = 0;
      
      for (const item of updateData.items) {
        const amount = item.quantity * item.unitPrice;
        const taxAmount = item.taxRate ? (amount * item.taxRate / 100) : 0;
        
        if (item.id) {
          // Existing item, update it
          itemsToUpdate.push({
            where: { id: item.id },
            data: {
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: amount,
              taxRate: item.taxRate,
              taxAmount: taxAmount,
            },
          });
          itemIds.push(item.id);
        } else {
          // New item, create it
          itemsToCreate.push({
            invoiceId: id, // Changed from invoiceId to id
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: amount,
            taxRate: item.taxRate,
            taxAmount: taxAmount,
          });
        }
        
        totalAmount += amount + taxAmount;
      }
      
      // Update the invoice amount
      updateData.amount = totalAmount;
    }
    
    // Create a transaction to update invoice and items
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // If we have items to update, do that first
      if (updateData.items && invoice.status === 'DRAFT') {
        // Delete items not in the updated list
        await tx.invoiceItem.deleteMany({
          where: {
            invoiceId: id, // Changed from invoiceId to id
            id: { notIn: itemIds },
          },
        });
        
        // Update existing items
        for (const item of itemsToUpdate) {
          await tx.invoiceItem.update(item);
        }
        
        // Create new items
        if (itemsToCreate.length > 0) {
          await tx.invoiceItem.createMany({
            data: itemsToCreate,
          });
        }
      }
      
      // Update the invoice
      return tx.invoice.update({
        where: { id },
        data: {
          status: updateData.status,
          dueDate: updateData.dueDate,
          notes: updateData.notes,
          amount: updateData.amount,
          paidAt: updateData.paidAt,
          metadata: {
            ...invoice.metadata,
            lastUpdated: new Date().toISOString(),
            updatedBy: session.user.id,
            paymentTerms: updateData.paymentTerms,
            paymentInstructions: updateData.paymentInstructions,
          },
        },
        include: {
          items: true,
        },
      });
    });
    
    // Log the update activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: updateData.status ? `INVOICE_STATUS_${updateData.status}` : 'INVOICE_UPDATED',
        resourceId: id, // Changed from invoiceId to id
        resourceType: 'INVOICE',
        details: {
          invoiceNumber: invoice.number,
          previousStatus: invoice.status,
          newStatus: updateData.status,
          organizationId: invoice.organizationId,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice,
    });
    
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ 
      error: 'Failed to update invoice', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params; // Changed from invoiceId to id
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only allow admins to delete invoices
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete invoices' }, { status: 403 });
    }
    
    // Find the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Only allow deleting draft invoices
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json({ 
        error: 'Only draft invoices can be deleted. Cancel the invoice instead.' 
      }, { status: 400 });
    }
    
    // Delete invoice items first, then the invoice
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id }, // Changed from invoiceId to id
      });
      
      await tx.invoice.delete({
        where: { id },
      });
    });
    
    // Log the deletion
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'INVOICE_DELETED',
        resourceId: id, // Changed from invoiceId to id
        resourceType: 'INVOICE',
        details: {
          invoiceNumber: invoice.number,
          organizationId: invoice.organizationId,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
    
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ 
      error: 'Failed to delete invoice', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}