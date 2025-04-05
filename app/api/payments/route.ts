import { NextRequest, NextResponse } from "next/server";
import { createOneTimePayment, getOrganizationOneTimePayments } from "@/lib/payments";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getServerSession } from 'next-auth/next';
import { requirePermission } from '@/lib/auth/rbac';
import { processPayment, getPaymentsByCustomer } from '@/lib/services/payment-service';

// Validation schema for creating a payment
const createPaymentSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema validation for payment processing
const processPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  paymentMethodId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET handler to list payments
export async function GET(req: NextRequest) {
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
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }
    
    // Check if the user has access to the customer
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
    
    // Get payments
    const result = await getPaymentsByCustomer(customerId, {
      limit,
      offset: (page - 1) * limit,
      status: status as any,
      startDate,
      endDate,
    });
    
    return NextResponse.json({
      data: result.data,
      meta: {
        ...result.meta,
        page,
        totalPages: Math.ceil(result.meta.total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error listing payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list payments' },
      { status: 500 }
    );
  }
}

// POST handler to create a payment
export async function POST(req: NextRequest) {
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
    
    // Validate request body
    const body = await req.json();
    const validationResult = processPaymentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { invoiceId, amount, currency, paymentMethodId, description, metadata } = validationResult.data;
    
    // Get the invoice to check permissions
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
        customer: true,
      },
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Process the payment
    const payment = await processPayment({
      invoiceId,
      amount,
      currency,
      paymentMethodId,
      customerId: invoice.customerId,
      description,
      metadata,
    });
    
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payment' },
      { status: 500 }
    );
  }
} 