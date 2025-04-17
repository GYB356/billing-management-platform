import { prisma } from './prisma';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createEvent } from './events';
import { createNotification } from './notifications';
import { NotificationChannel } from './types';
import paypal from '@paypal/checkout-server-sdk';
import { formatAmount } from './currency';
import { PrismaClient } from '@prisma/client';
import { withRetry } from '@/lib/utils/async';

// PayPal environment setup
const environment = process.env.NODE_ENV === 'production'
  ? new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    )
  : new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    );

const client = new paypal.core.PayPalHttpClient(environment);

interface PayPalOrderParams {
  organizationId: string;
  amount: number;
  currency: string;
  description?: string;
  invoiceId?: string;
  metadata?: Record<string, any>;
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status: string;
    status_details?: {
      reason: string;
    };
    supplementary_data?: {
      related_ids: {
        order_id: string;
      };
    };
  };
  create_time: string;
}

interface PayPalError extends Error {
  response?: {
    status: number;
    data: {
      name: string;
      message: string;
      debug_id: string;
    };
  };
}

export class PayPalService {
  private readonly prisma: PrismaClient;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a PayPal order for one-time payment
   */
  public async createOrder(params: PayPalOrderParams) {
    const request = new paypal.orders.OrdersCreateRequest();
    
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: params.currency.toUpperCase(),
          value: (params.amount / 100).toFixed(2) // Convert cents to dollars
        },
        description: params.description,
        custom_id: params.invoiceId,
      }]
    });

    try {
      const order = await client.execute(request);

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          organizationId: params.organizationId,
          amount: params.amount,
          currency: params.currency,
          provider: PaymentProvider.PAYPAL,
          status: PaymentStatus.PENDING,
          description: params.description || 'PayPal payment',
          paypalOrderId: order.result.id,
          invoiceId: params.invoiceId,
          metadata: {
            ...params.metadata,
            paypalOrderId: order.result.id
          }
        }
      });

      // Log event
      await createEvent({
        organizationId: params.organizationId,
        eventType: 'PAYPAL_ORDER_CREATED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        metadata: {
          orderId: order.result.id,
          amount: params.amount,
          currency: params.currency
        }
      });

      return {
        orderId: order.result.id,
        paymentId: payment.id,
        status: order.result.status
      };
    } catch (error) {
      console.error('PayPal order creation failed:', error);
      throw new Error('Failed to create PayPal order');
    }
  }

  /**
   * Capture a previously created PayPal order
   */
  public async captureOrder(orderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    
    try {
      const capture = await client.execute(request);

      // Find the associated payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          metadata: {
            path: ['paypalOrderId'],
            equals: orderId
          }
        }
      });

      if (!payment) {
        throw new Error('Payment record not found for PayPal order');
      }

      // Update payment status
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          metadata: {
            ...payment.metadata,
            capturedAt: new Date().toISOString(),
            paypalCaptureId: capture.result.purchase_units[0].payments.captures[0].id
          }
        }
      });

      // If there's an associated invoice, mark it as paid
      if (payment.invoiceId) {
        await this.prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date()
          }
        });
      }

      // Create notification
      await createNotification({
        organizationId: payment.organizationId,
        title: 'Payment Successful',
        message: `Your payment of ${formatAmount(payment.amount, payment.currency)} has been processed successfully.`,
        type: 'SUCCESS',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
      });

      return {
        paymentId: payment.id,
        status: updatedPayment.status
      };
    } catch (error) {
      console.error('PayPal capture failed:', error);
      throw new Error('Failed to capture PayPal payment');
    }
  }

  /**
   * Handle PayPal webhook events
   */
  public async handleWebhookEvent(event: PayPalWebhookEvent): Promise<void> {
    const { event_type: eventType, resource } = event;

    try {
      await withRetry(
        async () => {
          switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
              await this.updatePaymentStatus(resource, PaymentStatus.SUCCEEDED);
              break;
            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED':
              await this.updatePaymentStatus(
                resource,
                PaymentStatus.FAILED,
                resource.status_details?.reason
              );
              break;
            default:
              console.warn(`Unhandled PayPal webhook event: ${eventType}`);
          }
        },
        this.maxRetries,
        this.retryDelay
      );
    } catch (error) {
      const paypalError = error as PayPalError;
      console.error('PayPal webhook processing error:', {
        eventType,
        resourceId: resource.id,
        error: paypalError.message,
        status: paypalError.response?.status,
        debugId: paypalError.response?.data?.debug_id,
      });
      throw error; // Re-throw to trigger webhook retry
    }
  }

  private async updatePaymentStatus(
    resource: PayPalWebhookEvent['resource'],
    status: PaymentStatus,
    failureReason?: string
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        metadata: {
          path: ['paypalOrderId'],
          equals: resource.supplementary_data?.related_ids.order_id,
        },
      },
      select: {
        id: true,
        organizationId: true,
        metadata: true,
        amount: true,
      },
    });

    if (!payment) {
      throw new Error(
        `Payment record not found for PayPal order: ${resource.supplementary_data?.related_ids.order_id}`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          metadata: {
            ...payment.metadata,
            webhookProcessedAt: new Date().toISOString(),
            failureReason,
            paypalResourceId: resource.id,
          },
        },
      });

      // Create notification for failed payments
      if (status === PaymentStatus.FAILED) {
        await createNotification({
          organizationId: payment.organizationId,
          title: 'Payment Failed',
          message: failureReason || 'Payment capture failed',
          type: 'ERROR',
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            paypalOrderId: resource.supplementary_data?.related_ids.order_id,
          },
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
