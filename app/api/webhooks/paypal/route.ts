import { NextRequest, NextResponse } from 'next/server';
import { PayPalService } from '@/lib/paypal';
import crypto from 'crypto';

const paypalService = new PayPalService();

// Verify PayPal webhook signature
function verifyWebhookSignature(
  body: string,
  headers: Headers
): boolean {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is not configured');
  }

  const transmissionId = headers.get('paypal-transmission-id');
  const timestamp = headers.get('paypal-transmission-time');
  const webhookEvent = headers.get('paypal-transmission-sig');
  const certUrl = headers.get('paypal-cert-url');

  if (!transmissionId || !timestamp || !webhookEvent || !certUrl) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookId)
    .update(transmissionId + '|' + timestamp + '|' + body)
    .digest('hex');

  return webhookEvent === expectedSignature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = verifyWebhookSignature(body, request.headers);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(body);
    await paypalService.handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}