import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { validateInvoiceAccess } from '@/lib/validation';
import { InvoiceStatus } from '@prisma/client';

const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['PAID', 'CANCELLED', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PAID', 'CANCELLED'],
  CANCELLED: [],
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
=======
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } } // Consistently use 'id'
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id; // Use consistent parameter name
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
<<<<<<< HEAD
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
=======
        items: true,
        customer: true,
        subscription: true,
        taxes: true,
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });

    if (!invoice) {
<<<<<<< HEAD
      return new NextResponse('Invoice not found', { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const updateData = await request.json();

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
      },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Validate status transition if status is being updated
    if (
      updateData.status &&
      !allowedTransitions[invoice.status].includes(updateData.status)
    ) {
      return new NextResponse(
        `Invalid status transition from ${invoice.status} to ${updateData.status}`,
=======
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } } // Consistently use 'id'
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

    const id = params.id; // Use consistent parameter name
    const data = await req.json();

    // Check if invoice exists and belongs to user's organization
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: id,
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
        { status: 400 }
      );
    }

<<<<<<< HEAD
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: true,
        payments: true,
        taxRates: true,
      },
    });

    // If the invoice is connected to Stripe, update it there as well
    if (invoice.stripeInvoiceId) {
      try {
        await stripe.invoices.update(invoice.stripeInvoiceId, {
          description: updateData.description,
          // Add other Stripe-specific updates as needed
        });
      } catch (error) {
        console.error('Error updating Stripe invoice:', error);
        // Don't fail the request if Stripe update fails
      }
    }

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
=======
    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: id },
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
  }
}

export async function DELETE(
<<<<<<< HEAD
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // If the invoice is connected to Stripe, delete it there first
    if (invoice.stripeInvoiceId) {
      try {
        await stripe.invoices.del(invoice.stripeInvoiceId);
      } catch (error) {
        console.error('Error deleting Stripe invoice:', error);
        // Don't fail the request if Stripe deletion fails
      }
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
=======
  req: NextRequest,
  { params }: { params: { id: string } } // Consistently use 'id'
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

    const id = params.id; // Use consistent parameter name

    // Check if invoice exists and belongs to user's organization
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: id,
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
      where: { invoiceId: id },
    });

    // Delete invoice
    await prisma.invoice.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice' },
      { status: 500 }
    );
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
  }
}