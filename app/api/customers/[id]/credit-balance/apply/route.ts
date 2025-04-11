import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { createEvent } from '@/lib/events';
import { createNotification } from '@/lib/notifications';
import { NotificationChannel } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { z } from 'zod';

const applyCreditSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage billing
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
    const body = await request.json();
    const validationResult = applyCreditSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { invoiceId, amount } = validationResult.data;

    // Start a transaction to apply credit
    const result = await prisma.$transaction(async (tx) => {
      // Get customer and invoice
      const customer = await tx.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      if (customer.creditBalance < amount) {
        throw new Error('Insufficient credit balance');
      }

      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          customerId,
          status: {
            in: ['PENDING', 'PARTIALLY_PAID']
          }
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found or not eligible for credit application');
      }

      const remainingAmount = invoice.total - (invoice.paidAmount || 0);
      if (amount > remainingAmount) {
        throw new Error('Credit amount exceeds remaining invoice amount');
      }

      // Update customer credit balance
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          creditBalance: {
            decrement: amount
          }
        }
      });

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: {
            increment: amount
          },
          status: amount === remainingAmount ? 'PAID' : 'PARTIALLY_PAID',
          ...(amount === remainingAmount ? { paidAt: new Date() } : {})
        }
      });

      // Create credit adjustment record
      const adjustment = await tx.creditAdjustment.create({
        data: {
          customerId,
          organizationId: customer.organizationId,
          amount: -amount,
          type: 'INVOICE_PAYMENT',
          description: `Applied credit to invoice ${invoice.number}`,
          reason: 'Credit applied to invoice',
          invoiceId,
          adjustedById: session.user.id
        }
      });

      // Create event
      await createEvent({
        eventType: 'CREDIT_APPLIED_TO_INVOICE',
        resourceType: 'INVOICE',
        resourceId: invoiceId,
        organizationId: customer.organizationId,
        metadata: {
          amount,
          invoiceNumber: invoice.number,
          adjustmentId: adjustment.id,
          newBalance: updatedCustomer.creditBalance,
          newInvoiceStatus: updatedInvoice.status
        }
      });

      // Send notification
      await createNotification({
        organizationId: customer.organizationId,
        title: 'Credit Applied to Invoice',
        message: `${formatCurrency(amount, invoice.currency)} credit applied to invoice ${invoice.number}. New balance: ${formatCurrency(updatedCustomer.creditBalance, customer.preferredCurrency || 'USD')}`,
        type: 'INFO',
        data: {
          customerId,
          invoiceId,
          amount,
          newBalance: updatedCustomer.creditBalance,
          adjustmentId: adjustment.id
        },
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
      });

      return {
        success: true,
        newBalance: updatedCustomer.creditBalance,
        invoiceStatus: updatedInvoice.status,
        adjustment
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error applying credit to invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply credit to invoice' },
      { status: 500 }
    );
  }
}