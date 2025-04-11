import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { paymentMethodId, customerId, amount, currency = 'usd' } = await request.json();

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        subscription: true,
      },
    });

    if (!customer) {
      return new NextResponse('Customer not found', { status: 404 });
    }

    try {
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customer.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          customerId,
          amount,
          currency,
          status: paymentIntent.status,
          stripePaymentIntentId: paymentIntent.id,
          subscriptionId: customer.subscription?.id,
        },
      });

      // Send success notification
      await sendNotification({
        type: 'payment_success',
        userId: customer.userId,
        data: {
          paymentId: payment.id,
          amount,
          currency,
        },
      });

      return NextResponse.json({
        success: true,
        payment,
      });

    } catch (stripeError: any) {
      // Handle payment failure
      const payment = await prisma.payment.create({
        data: {
          customerId,
          amount,
          currency,
          status: 'failed',
          errorMessage: stripeError.message,
          subscriptionId: customer.subscription?.id,
        },
      });

      // Send failure notification
      await sendNotification({
        type: 'payment_failed',
        userId: customer.userId,
        data: {
          paymentId: payment.id,
          amount,
          currency,
          error: stripeError.message,
        },
      });

      // Schedule payment retry
      const response = await fetch('/api/payments/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: payment.id,
        }),
      });

      if (!response.ok) {
        console.error('Failed to schedule payment retry:', await response.text());
      }

      return NextResponse.json({
        success: false,
        error: stripeError.message,
        payment,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 