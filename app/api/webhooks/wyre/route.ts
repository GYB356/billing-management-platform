import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

interface WyreEvent {
  type: string;
  orderId: string;
  orderStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  transferId: string;
  timestamp: number;
  amount: string;
  sourceCurrency: string;
  destCurrency: string;
  exchangeRate: string;
  customerId: string;
  failureReason?: string;
}

function verifyWyreSignature(payload: string, signature: string): boolean {
  const secret = process.env.WYRE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Wyre webhook secret not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function handleOrderCompleted(event: WyreEvent) {
  console.log('Wyre order completed:', {
    orderId: event.orderId,
    amount: event.amount,
    sourceCurrency: event.sourceCurrency,
    destCurrency: event.destCurrency
  });

  // Update order status in database
  // await updateOrderStatus(event.orderId, 'completed');

  // Record the transaction
  // await recordTransaction({
  //   orderId: event.orderId,
  //   amount: parseFloat(event.amount),
  //   sourceCurrency: event.sourceCurrency,
  //   destCurrency: event.destCurrency,
  //   exchangeRate: parseFloat(event.exchangeRate),
  //   timestamp: event.timestamp
  // });

  // Send confirmation to customer
  // await sendOrderConfirmation(event.customerId, event);
}

async function handleOrderFailed(event: WyreEvent) {
  console.error('Wyre order failed:', {
    orderId: event.orderId,
    reason: event.failureReason
  });

  // Update order status
  // await updateOrderStatus(event.orderId, 'failed');

  // Notify customer
  // await sendFailureNotification(event.customerId, event);

  // Record failure for analytics
  // await recordFailedTransaction(event);
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = headers().get('x-wyre-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    if (!verifyWyreSignature(body, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body) as WyreEvent;

    switch (event.orderStatus) {
      case 'COMPLETED':
        await handleOrderCompleted(event);
        break;

      case 'FAILED':
        await handleOrderFailed(event);
        break;

      case 'PENDING':
        console.log('Wyre order pending:', event.orderId);
        break;

      case 'PROCESSING':
        console.log('Wyre order processing:', event.orderId);
        break;

      default:
        console.log(`Unhandled Wyre order status: ${event.orderStatus}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Wyre webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 