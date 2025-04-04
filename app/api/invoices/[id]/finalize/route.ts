import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/rbac';
import { finalizeInvoice } from '@/lib/services/invoice-service';

export async function POST(
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
    
    // Finalize the invoice
    const finalizedInvoice = await finalizeInvoice(invoiceId, session.user.id);
    
    return NextResponse.json(finalizedInvoice);
  } catch (error: any) {
    console.error('Error finalizing invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to finalize invoice' },
      { status: error.statusCode || 500 }
    );
  }
} 