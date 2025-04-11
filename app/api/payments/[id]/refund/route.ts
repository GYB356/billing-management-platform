import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { refundPayment } from '@/lib/services/payment-service';
import { z } from 'zod';

// Schema validation for refund request
const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
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
    
    const paymentId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = refundSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { amount, reason } = validationResult.data;
    
    // Check if the payment exists and user has access
    const payment = await prisma.oneTimePayment.findFirst({
      where: {
        id: paymentId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Process the refund
    const refundedPayment = await refundPayment(paymentId, amount, reason);
    
    return NextResponse.json(refundedPayment);
  } catch (error: any) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
} 