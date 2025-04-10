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

const adjustCreditSchema = z.object({
  amount: z.number(),
  reason: z.string(),
  description: z.string(),
  metadata: z.record(z.any()).optional(),
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
    const validationResult = adjustCreditSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { amount, reason, description, metadata } = validationResult.data;

    // Start a transaction to update credit balance
    const result = await prisma.$transaction(async (tx) => {
      // Get customer
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { organization: true }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Update customer credit balance
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          creditBalance: {
            increment: amount
          }
        }
      });

      // Create credit adjustment record
      const adjustment = await tx.creditAdjustment.create({
        data: {
          customerId,
          organizationId: customer.organizationId,
          amount,
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          description,
          reason,
          adjustedById: session.user.id,
          metadata
        }
      });

      // Create event
      await createEvent({
        eventType: amount > 0 ? 'CREDIT_ADDED' : 'CREDIT_DEDUCTED',
        resourceType: 'CUSTOMER',
        resourceId: customerId,
        organizationId: customer.organizationId,
        metadata: {
          amount,
          reason,
          adjustmentId: adjustment.id,
          newBalance: updatedCustomer.creditBalance
        }
      });

      // Send notification
      await createNotification({
        organizationId: customer.organizationId,
        title: amount > 0 ? 'Credit Added' : 'Credit Deducted',
        message: `${amount > 0 ? 'Credit of' : 'Debit of'} ${formatCurrency(Math.abs(amount), customer.preferredCurrency || 'USD')} ${amount > 0 ? 'added to' : 'deducted from'} account. New balance: ${formatCurrency(updatedCustomer.creditBalance, customer.preferredCurrency || 'USD')}`,
        type: 'INFO',
        data: {
          customerId,
          amount,
          newBalance: updatedCustomer.creditBalance,
          adjustmentId: adjustment.id
        },
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
      });

      return {
        adjustment,
        newBalance: updatedCustomer.creditBalance
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error adjusting credit balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to adjust credit balance' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view billing
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

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        creditBalance: true,
        creditAdjustments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            adjustedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Error getting credit balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get credit balance' },
      { status: 500 }
    );
  }
}