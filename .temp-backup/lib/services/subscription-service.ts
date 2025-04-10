
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

  /**
   * Update subscription with proration handling
   */
  public async updateSubscription({
    subscriptionId,
    newPlanId,
    quantity = 1,
    prorate = true
  }: {
    subscriptionId: string;
    newPlanId: string;
    quantity?: number;
    prorate?: boolean;
  }): Promise<{ success: boolean; subscription?: SubscriptionWithDetails; error?: string }> {
    try {
      // Get current subscription details
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          organization: true
        }
      });

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Get new plan details
      const newPlan = await prisma.pricingPlan.findUnique({
        where: { id: newPlanId }
      });

      if (!newPlan) {
        return { success: false, error: 'New plan not found' };
      }

      // Calculate impact of the change
      const impact = await this.calculatePlanChangeImpact(subscriptionId, newPlanId, quantity);
      
      // Determine if this is an upgrade, downgrade, or crossgrade
      const isUpgrade = impact.type === 'upgrade';
      const isDowngrade = impact.type === 'downgrade';
      
      // Handle immediate change or schedule for next billing period
      const effectiveDate = prorate ? new Date() : subscription.currentPeriodEnd;
      
      // If using Stripe, update the subscription there
      if (subscription.stripeSubscriptionId) {
        const stripeParams: any = {
          proration_behavior: prorate ? 'create_prorations' : 'none',
          items: [{
            id: subscription.stripeSubscriptionId,
            price: newPlan.stripeId,
            quantity
          }]
        };
        
        // For downgrades without proration, schedule the update
        if (isDowngrade && !prorate) {
          stripeParams.proration_behavior = 'none';
          stripeParams.trial_end = Math.floor(subscription.currentPeriodEnd.getTime() / 1000);
        }
        
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, stripeParams);
      }
      
      // Update subscription in database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId: newPlanId,
          quantity,
          updatedAt: new Date(),
          ...(isDowngrade && !prorate ? {} : { planId: newPlanId })
        },
        include: {
          plan: true,
          organization: true
        }
      });
      
      // If preserving usage data is needed, transfer it
      if (isUpgrade || (isDowngrade && prorate)) {
        await this.transferUsage(subscription as SubscriptionWithDetails, newPlan);
      }
      
      // Create an event for the plan change
      await createEvent({
        type: `SUBSCRIPTION_${impact.type.toUpperCase()}`,
        resourceType: 'SUBSCRIPTION',
        resourceId: subscriptionId,
        organizationId: subscription.organizationId,
        metadata: {
          oldPlanId: subscription.planId,
          newPlanId,
          effectiveDate,
          proration: prorate,
          proratedAmount: impact.proratedAmount
        }
      });
      
      // Send notification email
      await sendSubscriptionEmail({
        type: `plan_${impact.type}`,
        subscription: updatedSubscription as SubscriptionWithDetails,
        metadata: {
          oldPlan: subscription.plan.name,
          newPlan: newPlan.name,
          effectiveDate,
          featureChanges: impact.featureChanges
        }
      });
      
      return { success: true, subscription: updatedSubscription as SubscriptionWithDetails };
    } catch (error) {
      console.error('Error updating subscription:', error);
      return { success: false, error: 'Failed to update subscription' };
    }
  }
  
  /**
   * Calculate plan change impact
   */
  public async calculatePlanChangeImpact(
    subscriptionId: string,
    newPlanId: string,
    quantity: number = 1
  ): Promise<{
    type: 'upgrade' | 'downgrade' | 'crossgrade';
    proratedAmount: number;
    effectiveDate: Date;
    featureChanges: {
      added: string[];
      removed: string[];
      upgraded: { feature: string; oldLimit: number; newLimit: number }[];
      downgraded: { feature: string; oldLimit: number; newLimit: number }[];
    };
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            features: true
          }
        }
      }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = await prisma.pricingPlan.findUnique({
      where: { id: newPlanId },
      include: {
        features: true
      }
    });

    if (!newPlan) {
      throw new Error('New plan not found');
    }

    // Calculate change type
    const changeType = newPlan.price > subscription.plan.price ? 'upgrade' : 
                      newPlan.price < subscription.plan.price ? 'downgrade' : 
                      'crossgrade';

    // Calculate proration if Stripe is configured
    let proratedAmount = 0;
    if (subscription.stripeSubscriptionId) {
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.stripeCustomerId!,
        subscription: subscription.stripeSubscriptionId,
        subscription_items: [{
          id: subscription.stripeSubscriptionItemId!,
          price: newPlan.stripePriceId!,
          quantity
        }]
      });
      proratedAmount = invoice.amount_due;
    }

    // Analyze feature changes
    const featureChanges = {
      added: [] as string[],
      removed: [] as string[],
      upgraded: [] as { feature: string; oldLimit: number; newLimit: number }[],
      downgraded: [] as { feature: string; oldLimit: number; newLimit: number }[]
    };

    // Map features by code for easy comparison
    const currentFeatures = new Map(subscription.plan.features.map(f => [f.code, f]));
    const newFeatures = new Map(newPlan.features.map(f => [f.code, f]));

    // Find added and removed features
    for (const [code, feature] of newFeatures) {
      if (!currentFeatures.has(code)) {
        featureChanges.added.push(feature.name);
      }
    }

    for (const [code, feature] of currentFeatures) {
      if (!newFeatures.has(code)) {
        featureChanges.removed.push(feature.name);
      }
    }

    // Compare limits for common features
    for (const [code, newFeature] of newFeatures) {
      const currentFeature = currentFeatures.get(code);
      if (currentFeature && newFeature.limits && currentFeature.limits) {
        const newLimit = JSON.parse(newFeature.limits).maxUsage;
        const currentLimit = JSON.parse(currentFeature.limits).maxUsage;
        
        if (newLimit > currentLimit) {
          featureChanges.upgraded.push({
            feature: newFeature.name,
            oldLimit: currentLimit,
            newLimit
          });
        } else if (newLimit < currentLimit) {
          featureChanges.downgraded.push({
            feature: newFeature.name,
            oldLimit: currentLimit,
            newLimit
          });
        }
      }
    }

    return {
      type: changeType,
      proratedAmount,
      effectiveDate: subscription.currentPeriodEnd,
      featureChanges
    };
  }

  /**
   * Process subscription cancellation with feedback collection
   */
  public async cancelSubscriptionWithFeedback(
    subscriptionId: string,
    feedback: {
      reason: string;
      additionalFeedback?: string;
      cancelImmediately?: boolean;
    }
  ): Promise<SubscriptionWithDetails> {
    const subscription = await this.cancelSubscription(
      subscriptionId,
      feedback.cancelImmediately || false
    );

    // Store cancellation feedback
    await prisma.subscriptionCancellationFeedback.create({
      data: {
        subscriptionId,
        reason: feedback.reason,
        additionalFeedback: feedback.additionalFeedback,
        timestamp: new Date()
      }
    });

    // Trigger win-back workflow if appropriate
    if (['too_expensive', 'missing_features'].includes(feedback.reason)) {
      await this.initiateWinBackCampaign(subscriptionId, feedback.reason);
    }

    return subscription;
  }

  /**
   * Initiate win-back campaign for churned customers
   */
  private async initiateWinBackCampaign(
    subscriptionId: string,
    cancellationReason: string
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) return;

    // Define win-back offer based on cancellation reason
    const winBackOffer = cancellationReason === 'too_expensive'
      ? {
          type: 'DISCOUNT',
          details: {
            percentOff: 20,
            durationMonths: 3
          }
        }
      : {
          type: 'TRIAL_EXTENSION',
          details: {
            durationDays: 30
          }
        };

    // Create win-back campaign record
    await prisma.winBackCampaign.create({
      data: {
        subscriptionId,
        organizationId: subscription.organizationId,
        reason: cancellationReason,
        offer: winBackOffer,
        status: 'PENDING',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    // Schedule win-back emails
    const emailSchedule = [
      { days: 1, template: 'immediate_win_back' },
      { days: 7, template: 'seven_day_win_back' },
      { days: 15, template: 'final_win_back' }
    ];

    for (const schedule of emailSchedule) {
      await prisma.scheduledEmail.create({
        data: {
          organizationId: subscription.organizationId,
          template: schedule.template,
          scheduledFor: new Date(Date.now() + schedule.days * 24 * 60 * 60 * 1000),
          data: {
            subscriptionId,
            planName: subscription.plan.name,
            offer: winBackOffer
          }
        }
      });
    }
  }
}