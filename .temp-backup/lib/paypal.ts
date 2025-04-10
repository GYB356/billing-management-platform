import { prisma } from './prisma';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createEvent } from './events';
import { createNotification } from './notifications';
import { NotificationChannel } from './types';
import paypal from '@paypal/checkout-server-sdk';
import { formatAmount } from './currency';

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

export class PayPalService {
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
      const payment = await prisma.payment.create({
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
      const payment = await prisma.payment.findFirst({
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
      const updatedPayment = await prisma.payment.update({
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
        await prisma.invoice.update({
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
  public async handleWebhookEvent(event: any) {
    const eventType = event.event_type;
    const resource = event.resource;

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const payment = await prisma.payment.findFirst({
          where: {
            metadata: {
              path: ['paypalOrderId'],
              equals: resource.supplementary_data.related_ids.order_id
            }
          }
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.SUCCEEDED,
              metadata: {
                ...payment.metadata,
                webhookProcessedAt: new Date().toISOString()
              }
            }
          });
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const payment = await prisma.payment.findFirst({
          where: {
            metadata: {
              path: ['paypalOrderId'],
              equals: resource.supplementary_data.related_ids.order_id
            }
          }
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              metadata: {
                ...payment.metadata,
                failureReason: resource.status_details?.reason || 'Payment capture failed',
                webhookProcessedAt: new Date().toISOString()
              }
            }
          });

          // Create notification for failed payment
          await createNotification({
            organizationId: payment.organizationId,
            title: 'Payment Failed',
            message: `Your payment of ${formatAmount(payment.amount, payment.currency)} could not be processed.`,
            type: 'ERROR',
            channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
          });
        }
        break;
      }
    }
  }
}
