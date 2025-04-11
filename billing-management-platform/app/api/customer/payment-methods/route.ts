import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: {
          not: 'CANCELED',
        },
      },
    });

    if (!subscription?.metadata?.stripeCustomerId) {
      return NextResponse.json([]);
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.metadata.stripeCustomerId,
      type: 'card',
    });

    // Get default payment method
    const customer = await stripe.customers.retrieve(subscription.metadata.stripeCustomerId);
    const defaultPaymentMethodId = typeof customer === 'object' ? customer.invoice_settings?.default_payment_method : null;

    // Format the response
    const formattedPaymentMethods = paymentMethods.data.map(method => ({
      id: method.id,
      brand: method.card?.brand || 'unknown',
      last4: method.card?.last4 || '****',
      expMonth: method.card?.exp_month || 0,
      expYear: method.card?.exp_year || 0,
      isDefault: method.id === defaultPaymentMethodId,
    }));

    return NextResponse.json(formattedPaymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
} 