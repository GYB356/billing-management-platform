import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: paymentMethodId } = params;

    // Get customer
    const customer = await prisma.customer.findFirst({
      where: { userId: session.user.id },
    });

    if (!customer?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== customer.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      );
    }

    // Update customer's default payment method
    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    return NextResponse.json(
      { error: 'Failed to set default payment method' },
      { status: 500 }
    );
  }
}