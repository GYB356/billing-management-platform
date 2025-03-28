import { prisma } from "./prisma";
import { Promotion, Coupon, Subscription, PricingPlan, DiscountType } from "@prisma/client";
import { createEvent, EventSeverity } from "./events";
import { stripe } from "./stripe";

/**
 * Create a new promotion
 */
export async function createPromotion({
  name,
  description,
  discountType,
  discountAmount,
  currency = "USD",
  startDate,
  endDate,
  maxRedemptions,
  applicablePlans,
  metadata,
}: {
  name: string;
  description?: string;
  discountType: DiscountType;
  discountAmount: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  maxRedemptions?: number;
  applicablePlans?: string[];
  metadata?: Record<string, any>;
}): Promise<Promotion> {
  // Create promotion in Stripe first
  let stripePromotion;
  try {
    stripePromotion = await stripe.promotionCodes.create({
      coupon: await createStripeCouponForPromotion({
        name,
        discountType,
        discountAmount,
        currency,
        duration: endDate ? "once" : "forever",
        durationInMonths: endDate 
          ? Math.ceil((endDate.getTime() - (startDate || new Date()).getTime()) / (1000 * 60 * 60 * 24 * 30)) 
          : undefined,
      }),
      max_redemptions: maxRedemptions,
      metadata: {
        ...metadata,
        applicablePlans: applicablePlans?.join(","),
      },
    });
  } catch (error) {
    console.error("Error creating Stripe promotion:", error);
    throw new Error(`Failed to create promotion in Stripe: ${(error as Error).message}`);
  }

  // Create the promotion in our database
  const promotion = await prisma.promotion.create({
    data: {
      name,
      description,
      discountType,
      discountAmount,
      currency,
      startDate: startDate || new Date(),
      endDate,
      maxRedemptions,
      applicablePlans: applicablePlans || [],
      stripeId: stripePromotion.id,
      metadata: metadata || {},
    },
  });

  // Log the event
  await createEvent({
    eventType: "PROMOTION_CREATED",
    resourceType: "PROMOTION",
    resourceId: promotion.id,
    severity: EventSeverity.INFO,
    metadata: {
      name,
      discountType,
      discountAmount,
    },
  });

  return promotion;
}

/**
 * Helper to create a coupon in Stripe
 */
async function createStripeCouponForPromotion({
  name,
  discountType,
  discountAmount,
  currency,
  duration,
  durationInMonths,
}: {
  name: string;
  discountType: DiscountType;
  discountAmount: number;
  currency: string;
  duration: "forever" | "once" | "repeating";
  durationInMonths?: number;
}) {
  const coupon = await stripe.coupons.create({
    name,
    duration,
    duration_in_months: durationInMonths,
    ...(discountType === "PERCENTAGE"
      ? { percent_off: discountAmount }
      : { amount_off: discountAmount, currency }),
  });
  
  return coupon.id;
}

/**
 * Create a coupon code for a promotion
 */
export async function createCoupon({
  promotionId,
  code,
  maxRedemptions,
}: {
  promotionId: string;
  code: string;
  maxRedemptions?: number;
}): Promise<Coupon> {
  // Get the promotion
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
  });

  if (!promotion) {
    throw new Error(`Promotion with ID ${promotionId} not found`);
  }

  // Check if the code already exists
  const existingCoupon = await prisma.coupon.findUnique({
    where: { code },
  });

  if (existingCoupon) {
    throw new Error(`Coupon code ${code} already exists`);
  }

  // Create the coupon
  return prisma.coupon.create({
    data: {
      promotionId,
      code,
      maxRedemptions,
      active: true,
    },
  });
}

/**
 * Apply a coupon to a subscription
 */
export async function applyCouponToSubscription({
  subscriptionId,
  couponCode,
}: {
  subscriptionId: string;
  couponCode: string;
}): Promise<Subscription> {
  // Find the subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: true,
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error(`Subscription with ID ${subscriptionId} not found`);
  }

  // Validate the coupon
  const validation = await validateCouponCode(couponCode, subscription.planId);

  if (!validation.valid) {
    throw new Error(validation.message || 'Invalid coupon');
  }

  // Find the coupon
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode },
    include: {
      promotion: true,
    },
  });

  if (!coupon) {
    throw new Error(`Coupon with code ${couponCode} not found`);
  }

  // Calculate discount
  let discountAmount = 0;
  let discountPercent = 0;

  if (coupon.promotion.discountType === DiscountType.PERCENTAGE) {
    discountPercent = coupon.promotion.discountAmount;
  } else {
    discountAmount = coupon.promotion.discountAmount;
  }

  // Update Stripe subscription if exists
  if (subscription.stripeId) {
    try {
      // Add metadata about the coupon
      await stripe.subscriptions.update(subscription.stripeId, {
        metadata: {
          couponCode,
          discountAmount: discountAmount.toString(),
          discountPercent: discountPercent.toString(),
        },
      });
    } catch (error) {
      console.error('Error updating Stripe subscription:', error);
    }
  }

  // Update subscription in database
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      couponId: coupon.id,
      appliedDiscountAmount: discountAmount > 0 ? discountAmount : undefined,
      appliedDiscountPercent: discountPercent > 0 ? discountPercent : undefined,
    },
  });

  // Increment coupon redemption count
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: {
      redemptionCount: {
        increment: 1,
      },
    },
  });

  // Increment promotion redemption count
  await prisma.promotion.update({
    where: { id: coupon.promotion.id },
    data: {
      redemptionCount: {
        increment: 1,
      },
    },
  });

  // Log the event
  await createEvent({
    eventType: "COUPON_APPLIED",
    resourceType: "SUBSCRIPTION",
    resourceId: subscriptionId,
    severity: EventSeverity.INFO,
    metadata: {
      couponCode,
      discountType: coupon.promotion.discountType,
      discountAmount: coupon.promotion.discountAmount,
    },
  });

  return updatedSubscription;
}

/**
 * Validate a coupon for use
 */
function validateCoupon(coupon: Coupon & { promotion: Promotion }): void {
  // Check if active
  if (!coupon.active || !coupon.promotion.active) {
    throw new Error("This coupon is no longer active");
  }

  // Check redemption limits
  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
    throw new Error("This coupon has reached its maximum redemptions");
  }

  if (
    coupon.promotion.maxRedemptions &&
    coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions
  ) {
    throw new Error("This promotion has reached its maximum redemptions");
  }

  // Check promotion dates
  const now = new Date();
  if (coupon.promotion.startDate > now) {
    throw new Error("This promotion has not started yet");
  }

  if (coupon.promotion.endDate && coupon.promotion.endDate < now) {
    throw new Error("This promotion has expired");
  }
}

/**
 * Calculate the discounted price
 */
export function calculateDiscountedPrice(
  basePrice: number,
  promotion: Promotion | null,
): number {
  if (!promotion) return basePrice;

  if (promotion.discountType === "PERCENTAGE") {
    const discountAmount = (basePrice * promotion.discountAmount) / 100;
    return Math.max(0, basePrice - discountAmount);
  } else if (promotion.discountType === "FIXED_AMOUNT") {
    return Math.max(0, basePrice - promotion.discountAmount);
  }

  return basePrice;
}

/**
 * Get all active promotions
 */
export async function getActivePromotions(planId?: string): Promise<Promotion[]> {
  const now = new Date();
  
  const whereClause: any = {
    active: true,
    startDate: { lte: now },
    OR: [
      { endDate: null },
      { endDate: { gte: now } },
    ],
  };
  
  // If planId is provided, filter by applicable plans
  if (planId) {
    whereClause.applicablePlans = {
      has: planId,
    };
  }
  
  return prisma.promotion.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Validate a coupon code and return discount information
 */
export async function validateCouponCode(code: string, planId?: string) {
  // Find the coupon
  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      promotion: true,
    },
  });

  if (!coupon) {
    return {
      valid: false,
      message: 'Invalid coupon code',
    };
  }

  // Check if coupon is active
  if (!coupon.active) {
    return {
      valid: false,
      message: 'This coupon is no longer active',
    };
  }

  // Check if promotion is active
  if (!coupon.promotion.active) {
    return {
      valid: false,
      message: 'This promotion is no longer active',
    };
  }

  // Check if promotion has started
  const now = new Date();
  if (coupon.promotion.startDate > now) {
    return {
      valid: false,
      message: 'This promotion has not started yet',
    };
  }

  // Check if promotion has ended
  if (coupon.promotion.endDate && coupon.promotion.endDate < now) {
    return {
      valid: false,
      message: 'This promotion has ended',
    };
  }

  // Check if promotion has reached max redemptions
  if (
    coupon.promotion.maxRedemptions &&
    coupon.promotion.redemptionCount >= coupon.promotion.maxRedemptions
  ) {
    return {
      valid: false,
      message: 'This promotion has reached its maximum number of redemptions',
    };
  }

  // Check if coupon has reached max redemptions
  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
    return {
      valid: false,
      message: 'This coupon has reached its maximum number of redemptions',
    };
  }

  // Check if plan is eligible for this promotion
  if (planId && !coupon.promotion.applicablePlans.includes(planId)) {
    return {
      valid: false,
      message: 'This coupon is not valid for the selected plan',
    };
  }

  // Return the discount information
  return {
    valid: true,
    code: coupon.code,
    discount: {
      type: coupon.promotion.discountType === DiscountType.PERCENTAGE ? 'percentage' : 'fixed',
      value: coupon.promotion.discountAmount,
      currency: coupon.promotion.currency,
    },
    planId: planId,
  };
} 