import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { 
  Subscription, 
  PricingPlan, 
  Organization,
  SubscriptionStatus,
  PlanFeature 
} from '@prisma/client';
import { sendSubscriptionEmail } from '@/lib/email';
import { InvoiceService } from './invoice-service';
import { UsageService } from './usage-service';
import Stripe from 'stripe';

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

export interface PlanChangeParams {
  subscriptionId: string;
  newPlanId: string;
  immediateChange?: boolean;
  preserveUsage?: boolean;
  prorationDate?: Date;
}

export interface SubscriptionWithDetails extends Subscription {
  plan: PricingPlan;
  organization: Organization;
  planFeatures?: PlanFeature[];
}

export class SubscriptionService {
  private readonly invoiceService: InvoiceService;
  private readonly usageService: UsageService;

  constructor() {
    this.invoiceService = new InvoiceService();
    this.usageService = new UsageService();
  }

  /**
   * Creates a new subscription
   */
  public async createSubscription(params: SubscriptionParams): Promise<SubscriptionWithDetails> {
    const { 
      customerId,
      organizationId,
      planId,
      priceId,
      quantity = 1,
      trialDays,
      paymentMethodId,
      metadata = {},
      couponId,
      taxRateIds = []
    } = params;

    // Get the organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get the plan
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Create Stripe subscription if Stripe is enabled
    let stripeSubscription;
    if (organization.stripeCustomerId) {
      const stripeSubscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: organization.stripeCustomerId,
        items: [{ price: priceId, quantity }],
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          organizationId,
          planId,
          ...metadata
        }
      };

      // Add trial if specified
      if (trialDays) {
        stripeSubscriptionParams.trial_period_days = trialDays;
      }

      // Add payment method if specified
      if (paymentMethodId) {
        stripeSubscriptionParams.default_payment_method = paymentMethodId;
      }

      // Add coupon if specified
      if (couponId) {
        stripeSubscriptionParams.coupon = couponId;
      }

      // Add tax rates if specified
      if (taxRateIds.length > 0) {
        stripeSubscriptionParams.default_tax_rates = taxRateIds;
      }

      stripeSubscription = await stripe.subscriptions.create(stripeSubscriptionParams);
    }

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status: stripeSubscription ? 'ACTIVE' : 'PENDING',
        quantity,
        currentPeriodStart: stripeSubscription 
          ? new Date(stripeSubscription.current_period_start * 1000) 
          : new Date(),
        currentPeriodEnd: stripeSubscription
          ? new Date(stripeSubscription.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId: stripeSubscription?.id,
        trialEndsAt: stripeSubscription?.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000) 
          : null,
        metadata
      },
      include: {
        plan: true,
        organization: true
      }
    });

    // Send email notification
    await sendSubscriptionEmail(
      organization.email!,
      'subscription_created',
      {
        planName: plan.name,
        startDate: subscription.currentPeriodStart,
        endDate: subscription.currentPeriodEnd,
        price: plan.basePrice / 100, // Convert from cents to dollars
        currency: plan.currency
      }
    );

    return subscription;
  }

  /**
   * Update subscription plan
   */
  public async changePlan({
    subscriptionId,
    newPlanId,
    immediateChange = false,
    preserveUsage = true,
    prorationDate
  }: PlanChangeParams): Promise<SubscriptionWithDetails> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = await prisma.pricingPlan.findUnique({
      where: { id: newPlanId }
    });

    if (!newPlan) {
      throw new Error('New plan not found');
    }

    // Handle usage transfer if needed
    if (preserveUsage) {
      await this.transferUsage(subscription, newPlan);
    }

    // Update in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      const stripeParams: Stripe.SubscriptionUpdateParams = {
        proration_behavior: immediateChange ? 'always_invoice' : 'create_prorations',
        items: [{
          id: subscription.stripeSubscriptionId,
          price: newPlan.stripePriceId!,
          quantity: subscription.quantity
        }]
      };

      if (prorationDate) {
        stripeParams.proration_date = Math.floor(prorationDate.getTime() / 1000);
      }

      await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        stripeParams
      );
    }

    // Update in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        updatedAt: new Date()
      },
      include: {
        plan: true,
        organization: true
      }
    });

    // Create change event
    await createEvent({
      type: 'SUBSCRIPTION_PLAN_CHANGED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscriptionId,
      metadata: {
        oldPlanId: subscription.planId,
        newPlanId,
        immediateChange,
        preserveUsage
      }
    });

    // Send notification
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'plan_changed',
      {
        oldPlan: subscription.plan.name,
        newPlan: newPlan.name,
        effectiveDate: immediateChange ? new Date() : subscription.currentPeriodEnd
      }
    );

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  public async cancelSubscription(
    subscriptionId: string,
    cancelImmediately = false
  ): Promise<SubscriptionWithDetails> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      if (cancelImmediately) {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }
    }

    // Update in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: cancelImmediately ? 'CANCELLED' : 'ACTIVE',
        canceledAt: new Date(),
        cancelAtPeriodEnd: !cancelImmediately,
        endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd
      },
      include: {
        plan: true,
        organization: true
      }
    });

    // Send notification
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_cancelled',
      {
        planName: subscription.plan.name,
        effectiveDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd
      }
    );

    return updatedSubscription;
  }

  /**
   * Resume cancelled subscription
   */
  public async resumeSubscription(subscriptionId: string): Promise<SubscriptionWithDetails> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new Error('Subscription is not scheduled for cancellation');
    }

    // Resume in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });
    }

    // Update in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
        endDate: null
      },
      include: {
        plan: true,
        organization: true
      }
    });

    // Send notification
    await sendSubscriptionEmail(
      subscription.organization.email!,
      'subscription_resumed',
      {
        planName: subscription.plan.name
      }
    );

    return updatedSubscription;
  }

  /**
   * Transfer usage data between plans
   */
  private async transferUsage(
    oldSubscription: SubscriptionWithDetails,
    newPlan: PricingPlan
  ): Promise<void> {
    // Get current usage for all features
    const usage = await this.usageService.getSubscriptionUsageSummary(
      oldSubscription.id,
      oldSubscription.currentPeriodStart!,
      new Date()
    );

    // Transfer usage to new plan where feature mappings exist
    for (const featureUsage of usage.features) {
      const oldFeature = featureUsage.feature;
      const newFeature = await prisma.planFeature.findFirst({
        where: {
          planId: newPlan.id,
          code: oldFeature.code // Assuming features have a code that maps between plans
        }
      });

      if (newFeature) {
        await this.usageService.recordUsage({
          subscriptionId: oldSubscription.id,
          featureId: newFeature.id,
          quantity: featureUsage.totalUsage,
          timestamp: new Date(),
          metadata: {
            transferred: true,
            fromFeatureId: oldFeature.id
          }
        });
      }
    }
  }
}