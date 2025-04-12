import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { defaultCryptoConfig, CryptoPaymentConfig } from './config';
import { createEvent } from '@/lib/events';
import { prisma } from '@/lib/db';

export class StripeCryptoService {
  private config: CryptoPaymentConfig;

  constructor(config: CryptoPaymentConfig = defaultCryptoConfig) {
    this.config = config;
    if (!config.processors.stripe.enabled) {
      throw new Error('Stripe crypto payments are not enabled');
    }
  }

  /**
   * Create a payment intent for crypto payment
   */
  async createCryptoPaymentIntent({
    amount,
    currency,
    customerId,
    organizationId,
  }: {
    amount: number;
    currency: string;
    customerId: string;
    organizationId: string;
  }) {
    try {
      // Verify supported currency
      if (!this.config.supportedCurrencies.includes(currency.toLowerCase() as any)) {
        throw new Error(`Currency ${currency} is not supported for crypto payments`);
      }

      // Create a PaymentIntent with crypto payment method
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        payment_method_types: this.config.processors.stripe.cryptoPaymentMethodTypes,
        payment_method_options: {
          crypto: {
            // Supported networks: ethereum, solana, etc.
            networks: ['ethereum'],
          },
        },
        metadata: {
          paymentType: 'crypto',
          organizationId,
        },
      });

      // Create an event for the crypto payment intent
      await createEvent({
        organizationId,
        eventType: 'crypto_payment.created',
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id,
        severity: 'INFO',
        metadata: {
          amount,
          currency,
          paymentIntentId: paymentIntent.id,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
      };
    } catch (error) {
      console.error('Error creating crypto payment intent:', error);
      throw error;
    }
  }

  /**
   * Handle successful crypto payment
   */
  async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
    try {
      const { organizationId } = paymentIntent.metadata;

      if (!organizationId) {
        throw new Error('Organization ID not found in payment intent metadata');
      }

      // Update organization's payment history
      await prisma.payment.create({
        data: {
          organizationId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'succeeded',
          paymentMethodType: 'crypto',
          stripePaymentIntentId: paymentIntent.id,
          metadata: {
            network: paymentIntent.payment_method_options?.crypto?.networks?.[0],
          },
        },
      });

      // Create success event
      await createEvent({
        organizationId,
        eventType: 'crypto_payment.succeeded',
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id,
        severity: 'INFO',
        metadata: {
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentIntentId: paymentIntent.id,
        },
      });
    } catch (error) {
      console.error('Error handling successful crypto payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed crypto payment
   */
  async handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
    try {
      const { organizationId } = paymentIntent.metadata;

      if (!organizationId) {
        throw new Error('Organization ID not found in payment intent metadata');
      }

      // Update organization's payment history
      await prisma.payment.create({
        data: {
          organizationId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'failed',
          paymentMethodType: 'crypto',
          stripePaymentIntentId: paymentIntent.id,
          errorMessage: paymentIntent.last_payment_error?.message,
        },
      });

      // Create failure event
      await createEvent({
        organizationId,
        eventType: 'crypto_payment.failed',
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id,
        severity: 'ERROR',
        metadata: {
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentIntentId: paymentIntent.id,
          errorMessage: paymentIntent.last_payment_error?.message,
        },
      });
    } catch (error) {
      console.error('Error handling failed crypto payment:', error);
      throw error;
    }
  }
} 