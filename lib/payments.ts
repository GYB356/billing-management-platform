import { prisma } from "./prisma";
import { OneTimePayment, PaymentStatus, Organization } from "@prisma/client";
import { createEvent, EventSeverity } from "./events";
import { createNotification } from "./notifications";
import { NotificationChannel } from "./types";
import { handleApiError } from "./utils/error-handling";
import { NextResponse } from "next/server";
import { retryOperation } from "./utils/retry";
import { createErrorResponse, createSuccessResponse } from "./utils/response-format";
import * as stripe from "./stripe";
import { rateLimit } from "./utils/rate-limit";import { LogLevel } from "./config";
import { Config } from "./config";

/**
 * Create a one-time payment
 */
export async function createOneTimePayment({
  organizationId,
  amount,
  currency = "USD",
  description,
  paymentMethod,
  metadata,
}: {
  organizationId: string;
  amount: number;
  currency?: string;
  description: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}): Promise<OneTimePayment> {
  // Get the organization
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${organizationId} not found`);
  }
  
  // Get the configuration
  const config = Config.getConfig();

  try {
    await rateLimit(organization.stripeCustomerId || 'unknown_customer');
  } catch (error) {
    return createErrorResponse(error);
  }


  // Create a payment intent in Stripe
  let stripePaymentIntent
  
  try{
    stripe.init(config.stripeSecretKey);
    stripePaymentIntent = await retryOperation(() =>
      stripe.paymentIntentsCreate({
        amount,
        currency,
        description,
        customer: organization.stripeCustomerId || undefined,
        payment_method: paymentMethod,
        confirm: !!paymentMethod,
        metadata: {
          organizationId,
          type: "ONE_TIME_PAYMENT",
          ...metadata,
        },
        organizationId,
        type: "ONE_TIME_PAYMENT",
        ...metadata,
      },
    });
    } catch (error) {
    if (config.logLevel <= LogLevel.DEBUG) {
      console.error("Error creating stripe payment intent:", error);
    }
  } catch (error) {
    return createErrorResponse(error);
  }

  // Create the payment record in our database
  const payment = await prisma.oneTimePayment.create({
    data: {
      organizationId,
      amount,
      currency,
      description,
      status: mapStripeStatusToPaymentStatus(stripePaymentIntent.status),
      paymentMethod: paymentMethod || null,
      stripeId: stripePaymentIntent.id,
      metadata: {
        clientSecret: stripePaymentIntent.client_secret,
        ...metadata,
      },
    },
  });

  // Log the event
  await createEvent({
    organizationId,
    eventType: "ONE_TIME_PAYMENT_CREATED",
    resourceType: "PAYMENT",
    resourceId: payment.id,
    severity: EventSeverity.INFO,
    metadata: {
      amount,
      currency,
      description,
      stripeStatus: stripePaymentIntent.status,
    },
  });

  return payment;
}

/**
 * Process a successful payment
 */
export async function processSuccessfulPayment(
  paymentId: string,
  stripePaymentIntentId: string
): Promise<OneTimePayment> {
    // Get the configuration
  const config = Config.getConfig();
  stripe.init(config.stripeSecretKey);
  // Get payment details from Stripe
  const paymentIntent = await stripe.paymentIntentsRetrieve(stripePaymentIntentId);
  
  // Find the payment in our database
  const payment = await prisma.oneTimePayment.findFirst({
    where: {
      OR: [
        { id: paymentId },
        { stripeId: stripePaymentIntentId },
      ]
    },
    include: {
      organization: true,
    },
  });

  if (!payment) {
    throw new Error(`Payment with ID ${paymentId} or Stripe ID ${stripePaymentIntentId} not found`);
  }

  // Update the payment status
  const updatedPayment = await prisma.oneTimePayment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      metadata: {
        ...payment.metadata as Record<string, any>,
        stripePaymentMethodId: paymentIntent.payment_method,
        stripeReceiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url,
        processedAt: new Date().toISOString(),
      },
    },
  });

  // Create an invoice for this payment
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: payment.organizationId,
      amount: payment.amount,
      currency: payment.currency,
      status: "PAID",
      dueDate: new Date(),
      paidDate: new Date(),
      oneTimePaymentId: payment.id,
      number: `OTP-${Math.floor(Math.random() * 10000)}`,
      stripeId: paymentIntent.invoice as string || null,
    },
  });

  // Send notification
  await createNotification({
    organizationId: payment.organizationId,
    title: "Payment Processed",
    message: `Your payment of ${formatAmount(payment.amount, payment.currency)} for "${payment.description}" has been successfully processed.`,
    type: "SUCCESS",
    data: {
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: payment.amount,
      currency: payment.currency,
    },
    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  });

  // Log the event
  await createEvent({
    organizationId: payment.organizationId,
    eventType: "PAYMENT_SUCCEEDED",
    resourceType: "PAYMENT",
    resourceId: payment.id,
    severity: EventSeverity.INFO,
    metadata: {
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      invoiceId: invoice.id,
    },
  });

  return updatedPayment;
}

/**
 * Map Stripe payment intent status to our PaymentStatus enum
 */
function mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
  switch (stripeStatus) {
    case "succeeded":
      return PaymentStatus.SUCCEEDED;
    case "processing":
    case "requires_action":
    case "requires_confirmation":
    case "requires_payment_method":
    case "requires_capture":
      return PaymentStatus.PENDING;
    case "canceled":
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PENDING;
  }
}

/**
 * Get a list of one-time payments for an organization
 */
export async function getOrganizationOneTimePayments(
  organizationId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: PaymentStatus;
  }
): Promise<{ payments: OneTimePayment[]; total: number }> {
  const { limit = 10, offset = 0, status } = options || {};
  
  const whereClause: any = { organizationId };
  if (status) {
    whereClause.status = status;
  }

  const [payments, total] = await Promise.all([
    prisma.oneTimePayment.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.oneTimePayment.count({ where: whereClause }),
  ]);

  return { payments, total };
}

/**
 * Format monetary amount for display
 */
export function formatAmount(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100); // Convert cents to dollars
}

/**
 * Get payment details
 */
export async function getPaymentDetails(
  paymentId: string
): Promise<OneTimePayment | null> {
  return prisma.oneTimePayment.findUnique({
    where: { id: paymentId },
  });
}

/**
 * Refund a payment
 */
export async function refundPayment({
  paymentId,
  amount,
  reason,
}: {
  paymentId: string;
  amount?: number; // Optional for partial refunds
  reason?: string;
}): Promise<OneTimePayment> {
  // Get the payment
  const payment = await prisma.oneTimePayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error(`Payment with ID ${paymentId} not found`);
  }

  if (payment.status !== PaymentStatus.SUCCEEDED) {
    throw new Error(`Cannot refund payment with status ${payment.status}`);
  }

  if (!payment.stripeId) {
    throw new Error("No Stripe payment ID found for this payment");
  }

  // Process refund in Stripe
  // Get the configuration
  const config = Config.getConfig();
  stripe.init(config.stripeSecretKey);
  try{
    await stripe.refundsCreate({
      payment_intent: payment.stripeId,
      amount: amount || undefined, // If not provided, refund the full amount
      reason: (reason as "duplicate" | "fraudulent" | "requested_by_customer" | undefined) || "requested_by_customer",
    });

    // Update payment status in our database
    const updatedPayment = await prisma.oneTimePayment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        metadata: {
          ...payment.metadata as Record<string, any>,
          refundedAt: new Date().toISOString(),
          refundedAmount: amount || payment.amount,
          refundReason: reason,
        },
      },
    });

    // Send notification
    await createNotification({
      organizationId: payment.organizationId,
      title: "Payment Refunded",
      message: `Your payment of ${formatAmount(amount || payment.amount, payment.currency)} for "${payment.description}" has been refunded.`,
      type: "INFO",
      data: {
        paymentId: payment.id,
        amount: amount || payment.amount,
        currency: payment.currency,
        reason,
      },
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    });

    // Log the event
    await createEvent({
      organizationId: payment.organizationId,
      eventType: "PAYMENT_REFUNDED",
      resourceType: "PAYMENT",
      resourceId: payment.id,
      severity: EventSeverity.WARNING,
      metadata: {
        amount: amount || payment.amount,
        currency: payment.currency,
        description: payment.description,
        reason,
      },
    });

    return updatedPayment;
  } catch (error) {
    if (config.logLevel <= LogLevel.DEBUG) {
      console.error("Error refunding payment:", error);
    }
    return createErrorResponse(error);

  }
} 