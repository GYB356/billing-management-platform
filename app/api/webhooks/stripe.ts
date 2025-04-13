import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error('Stripe secret key not configured');
}

const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2023-10-16', // Use the latest API version
});

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  
  if (!stripeWebhookSecret) {
    console.error('Stripe webhook secret not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  let event: Stripe.Event;
  
  try {
    // Verify the signature
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    // Handle different event types
    switch (event.type) {
      // Payment-related events
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Check if this was a crypto payment
        const isCryptoPayment = paymentIntent.metadata?.payment_method === 'crypto';
        
        await handleSuccessfulPayment(paymentIntent, isCryptoPayment);
        break;
        
      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      
      // Crypto payment events (specific to Stripe's crypto partners)
      case 'crypto.payment.created':
      case 'crypto.payment.updated':
        const cryptoPayment = event.data.object;
        await handleCryptoPayment(cryptoPayment);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handle successful payments
async function handleSuccessfulPayment(
  paymentIntent: Stripe.PaymentIntent,
  isCryptoPayment: boolean
) {
  // Extract relevant data
  const {
    id,
    amount,
    currency,
    customer,
    metadata,
  } = paymentIntent;

  // Update order status based on payment type
  await updateOrderStatus(metadata.order_id, 'paid', {
    processor: isCryptoPayment ? 'stripe_crypto' : 'stripe',
    amount: amount / 100, // Convert from cents
    currency,
    transactionId: id,
    customerId: customer?.toString() || undefined,
  });
}

// Handle subscription changes
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  // Process subscription data
  console.log(`Subscription ${subscription.id} status: ${subscription.status}`);
  
  // Update subscription in database
  // Implementation depends on your data model
}

// Handle crypto-specific payment events
async function handleCryptoPayment(cryptoPayment: any) {
  // Process crypto payment data
  // This would be specific to the crypto payment processor integrated with Stripe
  const { id, status, amount, currency, metadata } = cryptoPayment;
  
  if (status === 'completed') {
    await updateOrderStatus(metadata.order_id, 'paid', {
      processor: 'stripe_crypto',
      amount,
      currency,
      transactionId: id,
    });
  }
}

// Helper function to update order status (same as in crypto.ts)
async function updateOrderStatus(
  orderId: string, 
  status: string, 
  paymentDetails: {
    processor: string;
    amount: number;
    currency: string;
    transactionId: string;
    customerId?: string;
  }
) {
  // This would connect to your database
  // For now, just log the update
  console.log(`Updating order ${orderId} to status ${status} with payment details:`, paymentDetails);
  // Implement database update logic here
} 