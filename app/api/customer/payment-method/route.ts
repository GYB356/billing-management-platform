import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    // Get the customer from the database
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: { subscriptions: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Attach payment method to the Stripe customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(customer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update the subscription's default payment method if it exists
    const activeSubscription = customer.subscriptions.find(
      (sub) => sub.status === 'ACTIVE'
    );

    if (activeSubscription?.stripeSubscriptionId) {
      await stripe.subscriptions.update(activeSubscription.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment method update error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripeCustomerId,
      type: 'card',
    });

    const defaultPaymentMethodId = (await stripe.customers.retrieve(customer.stripeCustomerId))
      .invoice_settings.default_payment_method;

    const formattedPaymentMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    return NextResponse.json(formattedPaymentMethods);
  } catch (error) {
    console.error('Payment method fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paymentMethodId = searchParams.get('id');

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment method deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}
