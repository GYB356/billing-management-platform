import { NextRequest, NextResponse } from 'next/server';
import { cryptoProcessor } from '@/lib/payments/crypto-processor';
import { createMetric } from '@/lib/monitoring/metrics';
import crypto from 'crypto';

/**
 * Verify BitPay webhook signature
 */
function verifyBitPaySignature(req: NextRequest): boolean {
  const signature = req.headers.get('x-signature');
  if (!signature) return false;

  const payload = req.body;
  const hmac = crypto.createHmac('sha256', process.env.BITPAY_WEBHOOK_SECRET!);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature
    if (!verifyBitPaySignature(req)) {
      console.error('Invalid BitPay webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = await req.json();

    // Record webhook received metric
    await createMetric('webhook.received', 1, {
      provider: 'bitpay',
      event: payload.event?.name,
    });

    // Process webhook
    await cryptoProcessor.handleBitPayWebhook(payload);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing BitPay webhook:', error);
    
    // Record webhook error metric
    await createMetric('webhook.error', 1, {
      provider: 'bitpay',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
} 