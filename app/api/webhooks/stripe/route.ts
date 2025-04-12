import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { processStripeEvent } from '@/lib/analytics/stripe-monitor';
import logger from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Process the event
    await processStripeEvent(event);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
            },
          });
  } catch (err) {
    logger.error('Error processing Stripe webhook:', err as Error);
    return new Response(
      JSON.stringify({
        error: {
          message: 'Webhook handler failed',
        },
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 