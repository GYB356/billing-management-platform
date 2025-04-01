import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export interface SubscriptionParams {
  customerId: string;
  organizationId: string;
  planId: string;
  priceId: string;
  quantity?: number;
  trialDays?: number;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
  couponId?: string;
  taxRateIds?: string[];
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  planId: string;
  priceId: string;
  quantity?: number;
  prorate?: boolean;
  billingCycleAnchor?: 'now' | 'unchanged';
  metadata?: Record<string, any>;
}

export interface CancelSubscriptionParams {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscription?: any;
  error?: string;
  code?: string;
}

export class SubscriptionService {
  /**
   * Create a new subscription
   */
  async createSubscription(params: SubscriptionParams): Promise<SubscriptionResult> {
    try {
      const {
        customerId,
        organizationId,
        planId,
        priceId,
        quantity = 1,
        trialDays = 0,
        paymentMethodId,
        metadata = {},
        couponId,
        taxRateIds = [],
      } = params;

      // Get organization to check if we have a Stripe customer
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found',
          code: 'organization_not_found',
        };
      }

      let stripeCustomerId = organization.stripeCustomerId;

      // If we don't have a Stripe customer ID yet, create one
      if (!stripeCustomerId && customerId) {
        const user = await prisma.user.findUnique({
          where: { id: customerId },
        });

        if (!user) {
          return {
            success: false,
            error: 'User not found',
            code: 'user_not_found',
          };
        }

        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: {
            organizationId,
            userId: user.id,
          },
        });

        stripeCustomerId = customer.id;

        // Update the organization with the new Stripe customer ID
        await prisma.organization.update({
          where: { id: organizationId },
          data: { stripeCustomerId },
        });
      }

      if (!stripeCustomerId) {
        return {
          success: false,
          error: 'No Stripe customer ID available',
          code: 'missing_stripe_customer',
        };
      }

      // Set the payment method as default if provided
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });

        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Get the pricing plan to fetch details
      const pricingPlan = await prisma.pricingPlan.findUnique({
        where: { id: planId },
      });

      if (!pricingPlan) {
        return {
          success: false,
          error: 'Pricing plan not found',
          code: 'plan_not_found',
        };
      }

      // Create the subscription in Stripe
      const subscriptionData: any = {
        customer: stripeCustomerId,
        items: [
          {
            price: priceId,
            quantity,
          },
        ],
        metadata: {
          ...metadata,
          organizationId,
          planId,
        },
        expand: ['latest_invoice.payment_intent'],
      };

      // Add trial period if specified
      if (trialDays > 0) {
        const trialEnd = Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60;
        subscriptionData.trial_end = trialEnd;
      }

      // Add coupon if specified
      if (couponId) {
        subscriptionData.coupon = couponId;
      }

      // Add tax rates if specified
      if (taxRateIds.length > 0) {
        subscriptionData.default_tax_rates = taxRateIds;
      }

      // Create the subscription in Stripe
      const stripeSubscription = await stripe.subscriptions.create(subscriptionData);

      // Store the subscription in our database
      const subscription = await prisma.subscription.create({
        data: {
          organizationId,
          planId,
          status: stripeSubscription.status,
          quantity,
          startDate: new Date(stripeSubscription.start_date * 1000),
          endDate: stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000)
            : null,
          trialEndsAt: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          stripeSubscriptionId: stripeSubscription.id,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          metadata: metadata,
        },
      });

      return {
        success: true,
        subscription: {
          ...subscription,
          stripeSubscription,
        },
      };
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to create subscription',
        code: error.code || 'create_subscription_error',
      };
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    try {
      const {
        subscriptionId,
        planId,
        priceId,
        quantity,
        prorate = true,
        billingCycleAnchor = 'unchanged',
        metadata,
      } = params;

      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      if (!subscription.stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
          code: 'missing_stripe_subscription',
        };
      }

      // Fetch the Stripe subscription to get the items
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Get the subscription item ID for the main plan
      const subscriptionItemId = stripeSubscription.items.data[0].id;

      // Prepare subscription update data
      const updateData: any = {
        proration_behavior: prorate ? 'create_prorations' : 'none',
        items: [
          {
            id: subscriptionItemId,
            price: priceId,
            quantity: quantity || subscription.quantity,
          },
        ],
        metadata: {
          ...stripeSubscription.metadata,
          ...(metadata || {}),
          planId,
        },
      };

      // Set billing cycle anchor if needed
      if (billingCycleAnchor === 'now') {
        updateData.billing_cycle_anchor = 'now';
      }

      // Update the subscription in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        updateData
      );

      // Update the subscription in our database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId,
          quantity: quantity || subscription.quantity,
          status: updatedStripeSubscription.status,
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
          metadata: metadata ? { ...subscription.metadata, ...metadata } : subscription.metadata,
        },
      });

      return {
        success: true,
        subscription: {
          ...updatedSubscription,
          stripeSubscription: updatedStripeSubscription,
        },
      };
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to update subscription',
        code: error.code || 'update_subscription_error',
      };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<SubscriptionResult> {
    try {
      const { subscriptionId, cancelAtPeriodEnd = true, reason } = params;

      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      if (!subscription.stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
          code: 'missing_stripe_subscription',
        };
      }

      let updatedStripeSubscription;

      if (cancelAtPeriodEnd) {
        // Cancel at the end of the current period
        updatedStripeSubscription = await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
            metadata: {
              ...subscription.metadata,
              cancellation_reason: reason || 'user_canceled',
            },
          }
        );
      } else {
        // Cancel immediately
        updatedStripeSubscription = await stripe.subscriptions.del(
          subscription.stripeSubscriptionId
        );
      }

      // Update the subscription in our database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: updatedStripeSubscription.status,
          cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
          endDate: updatedStripeSubscription.canceled_at
            ? new Date(updatedStripeSubscription.canceled_at * 1000)
            : cancelAtPeriodEnd
            ? new Date(updatedStripeSubscription.current_period_end * 1000)
            : new Date(),
          metadata: {
            ...subscription.metadata,
            cancellation_reason: reason || 'user_canceled',
          },
        },
      });

      return {
        success: true,
        subscription: updatedSubscription,
      };
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel subscription',
        code: error.code || 'cancel_subscription_error',
      };
    }
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    try {
      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      if (!subscription.stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
          code: 'missing_stripe_subscription',
        };
      }

      // Pause the subscription in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          pause_collection: {
            behavior: 'void',
          },
          metadata: {
            ...subscription.metadata,
            status_before_pause: subscription.status,
          },
        }
      );

      // Update the subscription in our database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'PAUSED',
          metadata: {
            ...subscription.metadata,
            status_before_pause: subscription.status,
          },
        },
      });

      return {
        success: true,
        subscription: {
          ...updatedSubscription,
          stripeSubscription: updatedStripeSubscription,
        },
      };
    } catch (error: any) {
      console.error('Error pausing subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to pause subscription',
        code: error.code || 'pause_subscription_error',
      };
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    try {
      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      if (!subscription.stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
          code: 'missing_stripe_subscription',
        };
      }

      // Get the previous status before pause, or default to 'active'
      const previousStatus = subscription.metadata?.status_before_pause || 'ACTIVE';

      // Resume the subscription in Stripe
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          pause_collection: '',
          metadata: {
            ...subscription.metadata,
            status_before_pause: undefined,
          },
        }
      );

      // Update the subscription in our database
      const updatedMetadata = { ...subscription.metadata };
      delete updatedMetadata.status_before_pause;

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: previousStatus,
          metadata: updatedMetadata,
        },
      });

      return {
        success: true,
        subscription: {
          ...updatedSubscription,
          stripeSubscription: updatedStripeSubscription,
        },
      };
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to resume subscription',
        code: error.code || 'resume_subscription_error',
      };
    }
  }

  /**
   * Retry failed payment for a subscription
   */
  async retryFailedPayment(subscriptionId: string, paymentMethodId: string): Promise<SubscriptionResult> {
    try {
      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      if (!subscription.stripeSubscriptionId) {
        return {
          success: false,
          error: 'No Stripe subscription ID found',
          code: 'missing_stripe_subscription',
        };
      }

      // Get the Stripe subscription to find the latest invoice
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
        {
          expand: ['latest_invoice'],
        }
      );

      // Make sure we have an unpaid invoice
      if (!stripeSubscription.latest_invoice || typeof stripeSubscription.latest_invoice === 'string') {
        return {
          success: false,
          error: 'No unpaid invoice found',
          code: 'no_unpaid_invoice',
        };
      }

      const invoice = stripeSubscription.latest_invoice;
      
      if (invoice.status !== 'open' && invoice.status !== 'uncollectible') {
        return {
          success: false,
          error: 'Invoice is not in a retryable state',
          code: 'invoice_not_retryable',
        };
      }

      // Get the customer ID from the invoice
      const customerId = invoice.customer as string;

      // Attach the payment method to the customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set it as the default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Retry the payment
      const updatedInvoice = await stripe.invoices.pay(invoice.id as string);

      // If payment succeeded, update the subscription status
      if (updatedInvoice.status === 'paid') {
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'ACTIVE',
          },
        });
      }

      return {
        success: true,
        subscription: {
          ...subscription,
          status: updatedInvoice.status === 'paid' ? 'ACTIVE' : subscription.status,
          invoice: updatedInvoice,
        },
      };
    } catch (error: any) {
      console.error('Error retrying payment:', error);
      return {
        success: false,
        error: error.message || 'Failed to retry payment',
        code: error.code || 'retry_payment_error',
      };
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string, includeStripeData = false): Promise<SubscriptionResult> {
    try {
      // Get the subscription from our database
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          organization: true,
        },
      });

      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found',
          code: 'subscription_not_found',
        };
      }

      // If requested, include Stripe data
      if (includeStripeData && subscription.stripeSubscriptionId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
          {
            expand: ['latest_invoice', 'latest_invoice.payment_intent'],
          }
        );

        return {
          success: true,
          subscription: {
            ...subscription,
            stripeSubscription,
          },
        };
      }

      return {
        success: true,
        subscription,
      };
    } catch (error: any) {
      console.error('Error getting subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to get subscription',
        code: error.code || 'get_subscription_error',
      };
    }
  }
} 