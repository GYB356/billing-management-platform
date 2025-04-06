import { NextRequest, NextResponse } from 'next/server';
import { PayPalService } from '@/lib/paypal';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const paypalService = new PayPalService();

// Schema for creating a PayPal order
const createOrderSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  invoiceId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    const order = await paypalService.createOrder({
      organizationId: session.user.organizationId,
      ...validatedData
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('PayPal order creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}