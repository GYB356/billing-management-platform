import { stripeApi } from '@/lib/stripe';
import {
  Subscription,
  PricingPlan,
  Organization,
  SubscriptionStatus,
  PlanFeature,
} from '@prisma/client';
import { handleApiError, createErrorResponse } from '@/lib/utils/error-handling';
import { sendSubscriptionEmail } from '@/lib/email';
import { InvoiceService } from './invoice-service';
import { UsageService } from './usage-service';
import { retryOperation } from '../utils/retry';
import { addDays, differenceInDays } from 'date-fns';
import { Config, LogLevel } from '../config';
import { EventManager } from '../events/events';
import { backgroundJobManager } from '../background-jobs/background-job-manager';

export interface IInvoiceService extends InvoiceService {}
export interface IUsageService extends UsageService {}
export interface IEventManager extends EventManager {}
export interface IBackgroundJobManager extends typeof backgroundJobManager {}

export interface IPrisma {
  subscription: any;
  organization: any;
  pricingPlan: any;
  $transaction: any;
  planFeature: any;
}

export interface IConfig extends Config {}
export interface IStripe extends typeof stripeApi {}

export interface IBackgroundJob {
  new (name: string, data?: any): any;
}

export interface SubscriptionParams {
  customerId: string;
  organizationId: string;
  planId: string;
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
export interface PlanComparison {
  plans: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    features: Array<
      {
        name: string;
        included: boolean;
        value?: string;
      }
    >;
    usageLimits: Array<
      {
        featureKey: string;
        limit: number;
        interval: string;
        overage: boolean;
        overagePrice?: number;
      }
    >;
  }>;
  differences: Array<{
    featureName: string;
    values: Record<string, string | boolean | number | null>;
  }>;
}

export class SubscriptionService {
  private readonly config: IConfig;
  private readonly prisma: IPrisma;
  private readonly stripeApi: IStripe;


  constructor(
    private readonly invoiceService: IInvoiceService,
    private readonly usageService: IUsageService,
    private readonly prisma: PrismaClient,
    private readonly stripeApi: Stripe,
    private readonly eventManager: IEventManager,
    private readonly backgroundJobManager: IBackgroundJobManager,
    private readonly BackgroundJob: typeof BackgroundJob,
    config: IConfig,
    prisma: IPrisma,
    stripeApi: IStripe,

  ) {
  }

  /**
   * Creates a new subscription
   */
  public async createSubscription(
    params: SubscriptionParams
  ): Promise<SubscriptionWithDetails> {
    const {
      priceId,
      organizationId,
      planId,
      customerId,
      organizationId,
      priceId,
      quantity = 1,
      trialDays,
      paymentMethodId,
      metadata = {},
      couponId,
      taxRateIds = []
    } = params;

    // Get the organization
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const plan = await this.prisma.pricingPlan.findUnique({
      where: { id: planId },
    });

    
        if (!plan) {
        throw new Error('Plan not found') ;
    }

    // Create Stripe subscription if Stripe is enabled
    let stripeSubscription;

    if (organization.stripeCustomerId) {
      const stripeSubscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: organization.stripeCustomerId,
        items: [{ price: priceId, quantity }],
        expand: ["latest_invoice.payment_intent"],
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

      stripeSubscription = await retryOperation(() => this.stripeApi.subscriptions.create(stripeSubscriptionParams), 3, 1000).catch((error)=> handleApiError(error));
      
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

    // Emit subscription created event
    this.eventManager.emit('subscription.created', {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        planId: subscription.planId,
        quantity: subscription.quantity,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStart
      });

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
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true
      }
    });

    if (!subscription) {
        throw new Error('Subscription not found');
    }

    const newPlan = await this.prisma.pricingPlan.findUnique({
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

      await retryOperation(() => this.stripeApi.subscriptions.update(subscription.stripeSubscriptionId, stripeParams),3,1000).catch((error) => {
      if(config.logLevel === LogLevel.DEBUG) {
        console.error(error);
      }
      return handleApiError(error);    }

    // Update in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId,},
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

    // Emit subscription plan updated event
    this.eventManager.emit('subscription.updated', {
      subscriptionId: updatedSubscription.id,
      newPlanId: newPlanId,
      immediateChange,
      preserveUsage,
    });

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
      where: { id: subscriptionId},
          include: {
              organization: true,
              plan: true,
          }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      //create a background job to send the email
        const jobData = {
            user: subscription.organization,
            subscription: subscription
        };
      
      const subscriptionCanceledEmailJob = new BackgroundJob(
        'send-subscription-canceled-email',
        jobData
      );
      backgroundJobManager.addJob(subscriptionCanceledEmailJob);

    let stripeSubscriptionResponse: Stripe.Subscription | undefined;
    await retryOperation(async () => { stripeSubscriptionResponse = await this.stripeApi.subscriptions.retrieve(subscription.stripeSubscriptionId); }, 3, 1000).catch(err => {
          if(this.config.logLevel === LogLevel.DEBUG) {
          console.error(err);
        }
          handleApiError(err);
        return createErrorResponse(err);
        });

        if (cancelImmediately) {
        await stripeApi.subscriptions.cancel(subscription.stripeSubscriptionId);
        await prisma.subscription.delete({where: {id: subscriptionId}});
      } else {
        await stripeApi.subscriptions.update(subscription.stripeSubscriptionId, {

          cancel_at_period_end: true
        });
      }
    }

    if(cancelImmediately && stripeSubscriptionResponse){
      const currentPeriodEnd = stripeSubscriptionResponse.current_period_end;
      const status = stripeSubscriptionResponse.status;
          const customerId = stripeSubscriptionResponse.customer as string;
      const refundAmount = (currentPeriodEnd - Math.floor(Date.now() / 1000)) > 0 ? ((currentPeriodEnd - Math.floor(Date.now() / 1000))/ (currentPeriodEnd - subscription.currentPeriodStart.getTime()/1000) )* subscription.plan.basePrice : 0;
      try{
        if(status === 'active'){
              //get the latest payment intent
              const customer = await this.stripeApi.customers.retrieve(customerId as string);
            if(customer && customer.invoice_settings.default_payment_method){
                const paymentMethods = await stripeApi.paymentMethods.list({
                  customer: customerId as string,
                  type: 'card',
                });
                if(paymentMethods && paymentMethods.data && paymentMethods.data.length > 0){
                  //get the latest charge
                  const charges = await stripeApi.charges.list({
                    customer: customerId,
                    payment_method: paymentMethods.data[0].id,
                    limit: 1,
                  });          
                  if(charges.data && charges.data.length > 0){
                    //create refund
                  
                    stripeApi.refunds.create({
                    amount: Math.round(refundAmount*100),
                    payment_intent: charges.data[0].payment_intent as string,
                   });
                }
              }
            }
        }
    } catch (error){ 
          handleApiError(error);
        }


    }
    const updatedSubscription = await retryOperation(()=>prisma.subscription.update({
        where: { id: subscriptionId },
        status: cancelImmediately ? 'CANCELLED' : 'ACTIVE',
        canceledAt: cancelImmediately ? new Date() : null,
        cancelAtPeriodEnd: !cancelImmediately,
        endDate: cancelImmediately ? new Date() : subscription.currentPeriodEnd,
        },
      include: {
        plan: true,
        organization: true,
      }
    });

    // Emit subscription cancelled event
    this.eventManager.emit('subscription.canceled', {
      subscriptionId: updatedSubscription.id,
      cancelImmediately,
    });

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
      await retryOperation(()=>this.stripeApi.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      }),3,1000).catch((error) => handleApiError(error));
      if(config.logLevel === LogLevel.DEBUG) {
        console.error(error);
      }
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
  public async updateSubscription(subscriptionId: string, newPriceId: string){

    const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
      });

      if (!subscription) {
      throw new Error('Subscription not found');
    }
    
      try{
      await prisma.$transaction(async (tx) => {
          let stripeSubscriptionResponse;
          await retryOperation(async () => {
          stripeSubscriptionResponse = await stripeApi.subscriptions.retrieve(subscription.stripeSubscriptionId);
          const updateParams:Stripe.SubscriptionUpdateParams = {
            proration_behavior: 'create_prorations',
            items: [{
              id: stripeSubscriptionResponse.items.data[0].id,
              price: newPriceId
            }],
            default_payment_method: null
          }
          const updatedStripeSubscription = await stripeApi.subscriptions.update(subscription.stripeSubscriptionId, updateParams);
          const updatedDbSubscription = await tx.subscription.update({
            where: { id: subscriptionId },
                  data: {
              status: updatedStripeSubscription.status as SubscriptionStatus,
              currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000)
            }
          });
          
          },3,1000).catch((error)=>{
          handleApiError(error);
           if(config.logLevel === LogLevel.DEBUG) {
            console.error(error);
          }
          throw error
        });

        if(stripeSubscriptionResponse){
          const invoices = await this.stripeApi.invoices.list({
            subscription: stripeSubscriptionResponse.id, 
                status: 'open',
                limit: 1
          });

           this.eventManager.emit('subscription.updated',{ 
            subscriptionId: updatedDbSubscription.id
          });

          if(invoices.data.length > 0){
            await stripeApi.invoices.voidInvoice(invoices.data[0].id);
          }
        }
      })
    } catch (error){
      if(config.logLevel === LogLevel.DEBUG) {
        console.error(error);
      }
      handleApiError(error);
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
         if (isDowngrade && !prorate) {
          stripeParams.proration_behavior = 'none';
          stripeParams.trial_end = Math.floor(subscription.currentPeriodEnd.getTime() / 1000);
        }       
        
        try{
        await this.stripeApi.subscriptions.update(subscription.stripeSubscriptionId, stripeParams);
        } catch (error) {
                handleApiError(error);
                if(this.config.logLevel === LogLevel.DEBUG) {
                console.error(error);
              }
            return createErrorResponse(error);
        }
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

      if(config.logLevel === LogLevel.DEBUG) {
        console.error('Error updating subscription:', error);
      }
      return handleApiError(error);
    
    
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
        try{
           const invoice = await stripeApi.invoices.retrieveUpcoming({
            customer: subscription.stripeCustomerId!,
            subscription: subscription.stripeSubscriptionId,
            subscription_items: [{
              id: subscription.stripeSubscriptionItemId!,
              price: newPlan.stripePriceId!,
              quantity
           }]
          });
          proratedAmount = invoice.amount_due;
        } catch (error) {
             if(config.logLevel === LogLevel.DEBUG) {
                console.error(error);
              }
        } catch (error) {   handleApiError(error);
            return {type: changeType,proratedAmount: 0,effectiveDate: subscription.currentPeriodEnd, featureChanges};        }
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
   * Compare multiple subscription plans
   */
  static async comparePlans(planIds: string[]): Promise<PlanComparison> {
    const plans = await prisma.pricingPlan.findMany({
      where: {
        id: {
          in: planIds,
        },
      },
      include: {
        features: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        usageLimits: true,
      },
    });

    // Create a map of all unique features across plans
    const allFeatures = new Set<string>();
    plans.forEach(plan => {
      plan.features.forEach(feature => allFeatures.add(feature.name));
    });

    // Compare features across plans
    const differences = Array.from(allFeatures).map(featureName => {
      const values: Record<string, string | boolean | number | null> = {};
      plans.forEach(plan => {
        const feature = plan.features.find(f => f.name === featureName);
        values[plan.id] = feature ? (feature.value || feature.included) : null;
      });
      return { featureName, values };
    });

    return {
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.basePrice,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features.map(f => ({
          name: f.name,
          included: f.included,
          value: f.value,
        })),
        usageLimits: plan.usageLimits.map(l => ({
          featureKey: l.featureKey,
          limit: l.limit,
          interval: l.interval,
          overage: l.overage,
          overagePrice: l.overagePrice,
        })),
      })),
      differences,
    };
  }

  /**
   * Record usage for a subscription
   */
  static async recordUsage(
    subscriptionId: string,
    featureKey: string,
    quantity: number,
    timestamp: Date = new Date()
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Create usage record
    await prisma.usageRecord.create({
      data: {
        subscriptionId,
        featureKey,
        quantity,
        timestamp,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
      },
    });

    // Check if usage exceeds limits
    const usageLimit = await prisma.usageLimit.findFirst({
      where: {
        planId: subscription.planId,
        featureKey,
      },
    });

    if (usageLimit) {
      const totalUsage = await prisma.usageRecord.aggregate({
        where: {
      } catch (error){
          if(config.logLevel === LogLevel.DEBUG) {
            console.error(error);
          }
          subscriptionId,
          featureKey,
          billingPeriodStart: subscription.currentPeriodStart,
          billingPeriodEnd: subscription.currentPeriodEnd,
        },
        _sum: {
          quantity: true,
        },
      });

      if (totalUsage._sum.quantity && totalUsage._sum.quantity > usageLimit.limit) {
        // Create overage charge if enabled
        if (usageLimit.overage && usageLimit.overagePrice) {
          const overageQuantity = totalUsage._sum.quantity - usageLimit.limit;
          const overageAmount = overageQuantity * usageLimit.overagePrice;
           try{
          await stripeApi.invoiceItems.create({
              customer: subscription.customer.stripeCustomerId!,
              amount: Math.round(overageAmount * 100), // Convert to cents
              currency: 'usd',
              description: `Overage charge for ${featureKey}`,
            });
        }
      }
      } catch (error) {
        handleApiError(error);
          return;
        }
      }
       
        // Notify about usage limit exceeded
        await prisma.notification.create({
          data: {
            type: 'USAGE_THRESHOLD',
            title: 'Usage Limit Exceeded',
            message: `Usage limit exceeded for ${featureKey}`,
            organizationId: subscription.customer.organizationId,
            channels: ['EMAIL', 'IN_APP'],
          },
        });
      }
    }
  }

  /**
   * Change subscription plan with proration
   */
  static async changePlan(
    subscriptionId: string,
    newPlanId: string,
    prorate: boolean = true
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const [currentPlan, newPlan] = await Promise.all([
      prisma.pricingPlan.findUnique({ where: { id: subscription.planId } }),
      prisma.pricingPlan.findUnique({ where: { id: newPlanId } }),
    ]);

    if (!currentPlan || !newPlan) {
      throw new Error('Plan not found');
    }

    // Calculate proration if enabled
    if (prorate) {
      const remainingDays = differenceInDays(
        subscription.currentPeriodEnd,
         if(config.logLevel === LogLevel.DEBUG) {
          console.error(error);
        }
        new Date()
      );
      const totalDays = differenceInDays(
        subscription.currentPeriodEnd,
        subscription.currentPeriodStart
      );
      
      const unusedAmount = (currentPlan.basePrice * remainingDays) / totalDays;
      const prorationAmount = newPlan.basePrice - unusedAmount;

      // Store proration details
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          proration: {
            amount: prorationAmount,
            date: new Date(),
            details: {
              remainingDays,
              totalDays,
              unusedAmount,
              newPlanPrice: newPlan.basePrice,
            },
          },
        },
      });

      // Create proration invoice item
      if (prorationAmount > 0) {
        await stripeApi.invoiceItems.create({
          customer: subscription.customer.stripeCustomerId!,
            amount: Math.round(prorationAmount * 100),
                currency: 'usd',
                description: `Proration charge for upgrading to ${newPlan.name}`,
         });
      }} catch (error){
          return handleApiError(error);
        }
      }
    }

    // Update subscription
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        updatedAt: new Date(),
      },
    });

    // Update Stripe subscription if exists
    if (subscription.customer.stripeCustomerId && newPlan.stripePriceId) {
      await stripeApi.subscriptions.update(subscription.customer.stripeCustomerId, {
          items: [{ price: newPlan.stripePriceId }],
          proration_behavior: prorate ? 'create_prorations' : 'none',
        });
    }
    } catch (error) {
      handleApiError(error);
    }
    }
  }

  /**
   * Manage subscription lifecycle
   */
  static async updateSubscriptionStatus(
    subscriptionId: string,
    action: 'activate' | 'cancel' | 'pause' | 'resume'
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    switch (action) {
      case 'activate':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'ACTIVE',
            pausedAt: null,
            resumesAt: null,
          },
        });
        break;

      case 'cancel':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'CANCELED',
            cancelAtPeriodEnd: true,
          },
        });

        if (subscription.customer.stripeCustomerId) {
          try{
          await stripeApi.subscriptions.update(subscription.customer.stripeCustomerId, {
              cancel_at_period_end: true,
            });
            } catch (error) {
              handleApiError(error);
              if(config.logLevel === LogLevel.DEBUG) {
                console.error(error);
              }
              return;
            }
        }
        break;

      case 'pause':
        const pausedAt = new Date();
        const resumesAt = addDays(pausedAt, 30); // Default pause duration

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'PAUSED',
            pausedAt,
            resumesAt,
          },
        });

        if (subscription.customer.stripeCustomerId) {
          try{
          await stripeApi.subscriptions.update(subscription.customer.stripeCustomerId, {
              pause_collection: {
                behavior: 'void',
                resumes_at: Math.floor(resumesAt.getTime() / 1000),
              },
            });
          } catch (error) {
            handleApiError(error);
            if(config.logLevel === LogLevel.DEBUG) {
              console.error(error);
            }
                return handleApiError(error);
            }
        }
        break;

      case 'resume':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'ACTIVE',
            pausedAt: null,
            resumesAt: null,
          },
        });

        if (subscription.customer.stripeCustomerId) {
          try{
          await stripeApi.subscriptions.update(subscription.customer.stripeCustomerId, {
              pause_collection: '',
            });
            } catch (error) {
              handleApiError(error);
              if(config.logLevel === LogLevel.DEBUG) {
                console.error(error);
              }
                return;
            }
        }
        break;

      default:
        throw new Error('Invalid subscription action');
    }
}
}
}