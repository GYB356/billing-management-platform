import { prisma } from '../prisma';
import { BitPayClient } from 'bitpay-sdk';
import { WyreClient } from '@wyre/api';
import { createMetric } from '../monitoring/metrics';
import { CarbonEstimate } from '@prisma/client';

interface CryptoPaymentOptions {
  amount: number;
  currency: string;
  cryptoCurrency?: string;
  description: string;
  orderId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
}

interface CryptoProcessorConfig {
  bitpay: {
    apiKey: string;
    env: 'prod' | 'test';
  };
  wyre: {
    apiKey: string;
    secretKey: string;
    env: 'prod' | 'test';
  };
}

class CryptoPaymentProcessor {
  private static instance: CryptoPaymentProcessor;
  private bitpayClient: BitPayClient;
  private wyreClient: WyreClient;
  private config: CryptoProcessorConfig;

  private constructor(config: CryptoProcessorConfig) {
    this.config = config;
    this.bitpayClient = new BitPayClient({
      apiKey: config.bitpay.apiKey,
      env: config.bitpay.env,
    });
    this.wyreClient = new WyreClient({
      apiKey: config.wyre.apiKey,
      secretKey: config.wyre.secretKey,
      env: config.wyre.env,
    });
  }

  public static getInstance(config: CryptoProcessorConfig): CryptoPaymentProcessor {
    if (!CryptoPaymentProcessor.instance) {
      CryptoPaymentProcessor.instance = new CryptoPaymentProcessor(config);
    }
    return CryptoPaymentProcessor.instance;
  }

  /**
   * Create a crypto payment through BitPay
   */
  public async createBitPayPayment(options: CryptoPaymentOptions) {
    try {
      const invoice = await this.bitpayClient.createInvoice({
        price: options.amount,
        currency: options.currency,
        orderId: options.orderId,
        notificationURL: `${process.env.API_URL}/api/webhooks/bitpay`,
        redirectURL: options.successUrl,
        buyer: {
          email: options.customerEmail,
        },
        itemDesc: options.description,
        metadata: options.metadata,
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          amount: options.amount,
          currency: options.currency,
          provider: 'BITPAY',
          status: 'PENDING',
          externalId: invoice.id,
          metadata: {
            invoiceUrl: invoice.url,
            ...options.metadata,
          },
          order: {
            connect: { id: options.orderId },
          },
        },
      });

      // Estimate carbon impact
      const carbonEstimate = await this.estimateCryptoCarbon({
        amount: options.amount,
        currency: options.currency,
        network: 'bitcoin',
      });

      return {
        payment,
        carbonEstimate,
        checkoutUrl: invoice.url,
      };
    } catch (error) {
      console.error('BitPay payment creation failed:', error);
      throw new Error('Failed to create BitPay payment');
    }
  }

  /**
   * Create a crypto payment through Wyre
   */
  public async createWyrePayment(options: CryptoPaymentOptions) {
    try {
      const reservation = await this.wyreClient.createReservation({
        amount: options.amount,
        sourceCurrency: options.currency,
        destCurrency: options.cryptoCurrency || 'BTC',
        dest: options.orderId,
        email: options.customerEmail,
        redirectUrl: options.successUrl,
        failureRedirectUrl: options.cancelUrl,
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          amount: options.amount,
          currency: options.currency,
          provider: 'WYRE',
          status: 'PENDING',
          externalId: reservation.id,
          metadata: {
            checkoutUrl: reservation.url,
            ...options.metadata,
          },
          order: {
            connect: { id: options.orderId },
          },
        },
      });

      // Estimate carbon impact
      const carbonEstimate = await this.estimateCryptoCarbon({
        amount: options.amount,
        currency: options.currency,
        network: options.cryptoCurrency?.toLowerCase() || 'bitcoin',
      });

      return {
        payment,
        carbonEstimate,
        checkoutUrl: reservation.url,
      };
    } catch (error) {
      console.error('Wyre payment creation failed:', error);
      throw new Error('Failed to create Wyre payment');
    }
  }

  /**
   * Estimate carbon impact of crypto transaction
   */
  private async estimateCryptoCarbon(params: {
    amount: number;
    currency: string;
    network: string;
  }): Promise<CarbonEstimate> {
    try {
      // Get network energy usage estimates (kWh per transaction)
      const energyUsage = await this.getNetworkEnergyUsage(params.network);

      // Convert to CO2 emissions (kg)
      const emissions = energyUsage * 0.475; // Global average grid carbon intensity

      // Create carbon estimate
      return prisma.carbonEstimate.create({
        data: {
          amount: params.amount,
          currency: params.currency,
          category: 'CRYPTO_PAYMENT',
          estimatedEmissions: emissions,
          status: 'ESTIMATED',
          rawEstimate: {
            network: params.network,
            energyUsage,
            gridIntensity: 0.475,
          },
        },
      });
    } catch (error) {
      console.error('Carbon estimation failed:', error);
      throw new Error('Failed to estimate carbon impact');
    }
  }

  /**
   * Get estimated energy usage for different crypto networks
   */
  private async getNetworkEnergyUsage(network: string): Promise<number> {
    // These are rough estimates and should be updated regularly
    const estimates: Record<string, number> = {
      bitcoin: 707, // kWh per transaction
      ethereum: 62.56, // kWh per transaction
      polygon: 0.0003, // kWh per transaction
      solana: 0.0002, // kWh per transaction
    };

    return estimates[network.toLowerCase()] || estimates.bitcoin;
  }

  /**
   * Handle BitPay webhook
   */
  public async handleBitPayWebhook(payload: any) {
    try {
      const invoice = await this.bitpayClient.getInvoice(payload.id);
      
      // Update payment status
      await prisma.payment.update({
        where: { externalId: invoice.id },
        data: {
          status: this.mapBitPayStatus(invoice.status),
          metadata: {
            ...invoice,
          },
        },
      });

      // Record metric
      await createMetric('crypto.payment.bitpay', invoice.price, {
        status: invoice.status,
        currency: invoice.currency,
      });
    } catch (error) {
      console.error('BitPay webhook processing failed:', error);
      throw new Error('Failed to process BitPay webhook');
    }
  }

  /**
   * Handle Wyre webhook
   */
  public async handleWyreWebhook(payload: any) {
    try {
      const transfer = await this.wyreClient.getTransfer(payload.transferId);

      // Update payment status
      await prisma.payment.update({
        where: { externalId: transfer.id },
        data: {
          status: this.mapWyreStatus(transfer.status),
          metadata: {
            ...transfer,
          },
        },
      });

      // Record metric
      await createMetric('crypto.payment.wyre', transfer.sourceAmount, {
        status: transfer.status,
        currency: transfer.sourceCurrency,
      });
    } catch (error) {
      console.error('Wyre webhook processing failed:', error);
      throw new Error('Failed to process Wyre webhook');
    }
  }

  private mapBitPayStatus(status: string): string {
    const statusMap: Record<string, string> = {
      new: 'PENDING',
      paid: 'PROCESSING',
      confirmed: 'SUCCEEDED',
      complete: 'SUCCEEDED',
      expired: 'FAILED',
      invalid: 'FAILED',
    };
    return statusMap[status] || 'PENDING';
  }

  private mapWyreStatus(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'SUCCEEDED',
      FAILED: 'FAILED',
    };
    return statusMap[status] || 'PENDING';
  }
}

export const cryptoProcessor = CryptoPaymentProcessor.getInstance({
  bitpay: {
    apiKey: process.env.BITPAY_API_KEY!,
    env: process.env.NODE_ENV === 'production' ? 'prod' : 'test',
  },
  wyre: {
    apiKey: process.env.WYRE_API_KEY!,
    secretKey: process.env.WYRE_SECRET_KEY!,
    env: process.env.NODE_ENV === 'production' ? 'prod' : 'test',
  },
}); 