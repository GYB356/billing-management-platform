import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { Queue } from 'bull';
import { sendNotification } from '@/lib/notifications';

// Initialize Bull Queue
const retryQueue = new Queue('payment-retries', {
  redis: {
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    host: process.env.REDIS_HOST || 'localhost',
  },
});

// Configure retry delays (in milliseconds)
const RETRY_DELAYS = {
  1: 3600000,    // 1 hour
  2: 21600000,   // 6 hours
  3: 86400000,   // 24 hours
  4: 259200000,  // 72 hours
};

const MAX_RETRIES = 4;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { paymentId } = await request.json();

    // Get payment details
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: true,
        customer: true,
      },
    });

    if (!payment) {
      return new NextResponse('Payment not found', { status: 404 });
    }

    // Check if payment is eligible for retry
    if (payment.status !== 'failed') {
      return new NextResponse('Payment is not eligible for retry', { status: 400 });
    }

    // Get retry attempt count
    const retryCount = await prisma.paymentRetry.count({
      where: { paymentId },
    });

    if (retryCount >= MAX_RETRIES) {
      // Send notification for maximum retries reached
      await sendNotification({
        type: 'payment_max_retries',
        userId: payment.customer.userId,
        data: {
          paymentId,
          customerId: payment.customerId,
          amount: payment.amount,
        },
      });

      return new NextResponse('Maximum retry attempts reached', { status: 400 });
    }

    // Schedule retry with appropriate delay
    const delay = RETRY_DELAYS[retryCount + 1];
    
    await retryQueue.add(
      'process-retry',
      {
        paymentId,
        attempt: retryCount + 1,
        customerId: payment.customerId,
        amount: payment.amount,
      },
      { delay }
    );

    // Log retry attempt
    await prisma.paymentRetry.create({
      data: {
        paymentId,
        attempt: retryCount + 1,
        scheduledFor: new Date(Date.now() + delay),
      },
    });

    // Send notification about scheduled retry
    await sendNotification({
      type: 'payment_retry_scheduled',
      userId: payment.customer.userId,
      data: {
        paymentId,
        attempt: retryCount + 1,
        scheduledFor: new Date(Date.now() + delay),
      },
    });

    return NextResponse.json({
      message: 'Payment retry scheduled',
      nextRetry: new Date(Date.now() + delay),
      attempt: retryCount + 1,
    });

  } catch (error) {
    console.error('Error scheduling payment retry:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 