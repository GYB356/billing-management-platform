import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/rbac';
import { RefundService } from '@/lib/services/refund-service';
import { z } from 'zod';

const refundSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  reason: z.string(),
  issueCredit: z.boolean().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const refundService = new RefundService();

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validationResult = refundSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { invoiceId, amount, reason, issueCredit, notes, metadata } = validationResult.data;

    const result = await refundService.processRefund({
      invoiceId,
      amount,
      reason,
      issueCredit,
      notes,
      metadata: {
        ...metadata,
        adjustedById: session.user.id,
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const refunds = await refundService.getRefundHistory(organizationId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      customerId: customerId || undefined,
    });

    return NextResponse.json(refunds);
  } catch (error: any) {
    console.error('Error getting refund history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get refund history' },
      { status: 500 }
    );
  }
}