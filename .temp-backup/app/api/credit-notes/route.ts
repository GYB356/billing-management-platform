import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/rbac';
import { CreditNoteService } from '@/lib/services/credit-note-service';
import { z } from 'zod';

const creditNoteSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  reason: z.string(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const creditNoteService = new CreditNoteService();

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
    const validationResult = creditNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { invoiceId, amount, reason, notes, metadata } = validationResult.data;

    const creditNote = await creditNoteService.createCreditNote({
      invoiceId,
      amount,
      reason,
      notes,
      metadata: {
        ...metadata,
        adjustedById: session.user.id,
      },
    });

    return NextResponse.json(creditNote);
  } catch (error: any) {
    console.error('Error creating credit note:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create credit note' },
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const creditNotes = await creditNoteService.listCreditNotes(organizationId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status: status || undefined,
    });

    return NextResponse.json(creditNotes);
  } catch (error: any) {
    console.error('Error listing credit notes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list credit notes' },
      { status: 500 }
    );
  }
}