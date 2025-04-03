import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { applyCredit } from '@/lib/services/credit-service';
import { z } from 'zod';

// Schema validation for applying credit
const applyCreditSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const customerId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = applyCreditSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { invoiceId, amount } = validationResult.data;
    
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
    
    // Check if the invoice exists and belongs to the customer
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Apply credit to the invoice
    const result = await applyCredit(
      customerId,
      invoiceId,
      amount,
      session.user.id
    );
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error applying credit to invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply credit to invoice' },
      { status: 500 }
    );
  }
} 