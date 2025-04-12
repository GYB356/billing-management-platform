 
import { cryptoProcessor } from '@/lib/payments/crypto-processor';
import { createMetric } from '@/lib/monitoring/metrics';
import crypto from 'crypto';

/**
 * Verify Coinbase Commerce webhook signature
 */
function verifyCoinbaseSignature(req: NextRequest): boolean {
  const signature = req.headers.get('x-cc-webhook-signature');
  const timestamp = req.headers.get('x-cc-timestamp');
  
  if (!signature || !timestamp) return false;

  const payload = req.body;
  const hmac = crypto.createHmac('sha256', process.env.COINBASE_WEBHOOK_SECRET!);
  hmac.update(timestamp + JSON.stringify(payload));
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature
    if (!verifyCoinbaseSignature(req)) {
      console.error('Invalid Coinbase Commerce webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = await req.json();

    // Record webhook received metric
    await createMetric('webhook.received', 1, {
      provider: 'coinbase',
      event: payload.event.type,
    });

    // Process webhook
    await cryptoProcessor.handleCoinbaseWebhook(payload);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Coinbase Commerce webhook:', error);
    
    // Record webhook error metric
    await createMetric('webhook.error', 1, {
      provider: 'coinbase',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}