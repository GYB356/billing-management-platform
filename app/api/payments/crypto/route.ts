import { NextResponse } from 'next/server';
import { BitPay } from 'bitpay-sdk';
import { WyreClient } from 'wyre-api';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { CryptoPaymentProcessor } from '@/app/billing/features/crypto/crypto-processor';

// Initialize payment processors
const bitpay = new BitPay({
  apiKey: process.env.BITPAY_API_KEY!,
  environment: process.env.NODE_ENV === 'production' ? 'prod' : 'test'
});

const wyre = new WyreClient({
  apiKey: process.env.WYRE_API_KEY!,
  secretKey: process.env.WYRE_SECRET_KEY!,
  accountId: process.env.WYRE_ACCOUNT_ID!
});

const cryptoProcessor = new CryptoPaymentProcessor({
  bitpay,
  wyre,
  stripe
});

export async function POST(req: Request) {
  try {
    const { amount, currency, paymentMethod, customerId } = await req.json();

    // Validate request
    if (!amount || !currency || !paymentMethod || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process payment based on selected method
    let paymentIntent;
    switch (paymentMethod) {
      case 'bitcoin':
      case 'ethereum':
        paymentIntent = await cryptoProcessor.createCryptoPayment({
          amount,
          currency,
          cryptoCurrency: paymentMethod,
          customerId,
          processor: 'bitpay'
        });
        break;

      case 'wyre_crypto':
        paymentIntent = await cryptoProcessor.createCryptoPayment({
          amount,
          currency,
          cryptoCurrency: 'auto',
          customerId,
          processor: 'wyre'
        });
        break;

      case 'stripe_crypto':
        paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          payment_method_types: ['card'],
          metadata: {
            payment_method: 'crypto',
            processor: 'stripe'
          }
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        );
    }

    // Store payment intent in database
    await prisma.payment.create({
      data: {
        amount,
        currency,
        status: 'pending',
        paymentIntentId: paymentIntent.id,
        customerId,
        processor: paymentMethod,
        metadata: {
          processor_response: paymentIntent
        }
      }
    });

    return NextResponse.json({ paymentIntent });
  } catch (error) {
    console.error('Error processing crypto payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
} 