import { prisma } from '@/lib/prisma';
import { PromotionType, DiscountType } from '@prisma/client';
import { createEvent } from '../events';

export interface CreatePromotionParams {
  name: string;
  description?: string;
  code: string;
  discountType: DiscountType;
  discountAmount: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  maxRedemptions?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  applicablePlans?: string[];
  applicableProducts?: string[];
  stackable?: boolean;
  metadata?: Record<string, any>;
}

export interface ValidatePromotionParams {
  code: string;
  planId?: string;
  productId?: string;
  purchaseAmount?: number;
  customerId?: string;
}

export class PromotionService {
  /**
   * Create a new promotion
   */
  public async createPromotion(params: CreatePromotionParams) {
    const {
      name,
      description,
      code,
      discountType,
      discountAmount,
      currency,
      startDate = new Date(),
      endDate,
      maxRedemptions,
      minPurchaseAmount,
      maxDiscountAmount,
      applicablePlans = [],
      applicableProducts = [],
      stackable = false,
      metadata = {}
    } = params;

    // Validate code uniqueness
    const existingPromotion = await prisma.promotion.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } }
    });

    if (existingPromotion) {
      throw new Error('Promotion code already exists');
    }

    // Create promotion
    const promotion = await prisma.promotion.create({
      data: {
        name,
        description,
        code: code.toUpperCase(),
        discountType,
        discountAmount,
        currency,
        startDate,
        endDate,
        maxRedemptions,
        minPurchaseAmount,
        maxDiscountAmount,
        applicablePlans,
        applicableProducts,
        stackable,
        metadata,
        active: true
      }
    });

    // Create event
    await createEvent({
      type: 'PROMOTION_CREATED',
      resourceType: 'PROMOTION',
      resourceId: promotion.id,
      metadata: {
        code: promotion.code,
        discountType,
        discountAmount
      }
    });

    return promotion;
  }

  /**
   * Validate a promotion code
   */
  public async validatePromotion(params: ValidatePromotionParams) {
    const {
      code,
      planId,
      productId,
      purchaseAmount,
      customerId
    } = params;

    const promotion = await prisma.promotion.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        active: true
      }
    });

    if (!promotion) {
      return {
        valid: false,
        reason: 'Promotion not found'
      };
    }

    // Check dates
    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      return {
        valid: false,
        reason: 'Promotion has not started yet'
      };
    }

    if (promotion.endDate && promotion.endDate < now) {
      return {
        valid: false,
        reason: 'Promotion has expired'
      };
    }

    // Check redemption limit
    if (promotion.maxRedemptions) {
      const redemptionCount = await prisma.promotionRedemption.count({
        where: { promotionId: promotion.id }
      });

      if (redemptionCount >= promotion.maxRedemptions) {
        return {
          valid: false,
          reason: 'Promotion redemption limit reached'
        };
      }
    }

    // Check minimum purchase amount
    if (promotion.minPurchaseAmount && purchaseAmount) {
      if (purchaseAmount < promotion.minPurchaseAmount) {
        return {
          valid: false,
          reason: 'Purchase amount below minimum required'
        };
      }
    }

    // Check plan applicability
    if (planId && promotion.applicablePlans.length > 0) {
      if (!promotion.applicablePlans.includes(planId)) {
        return {
          valid: false,
          reason: 'Promotion not applicable to selected plan'
        };
      }
    }

    // Check product applicability
    if (productId && promotion.applicableProducts.length > 0) {
      if (!promotion.applicableProducts.includes(productId)) {
        return {
          valid: false,
          reason: 'Promotion not applicable to selected product'
        };
      }
    }

    // Check customer usage
    if (customerId) {
      const customerUsage = await prisma.promotionRedemption.count({
        where: {
          promotionId: promotion.id,
          customerId
        }
      });

      if (customerUsage > 0 && !promotion.allowMultipleRedemptions) {
        return {
          valid: false,
          reason: 'Customer has already used this promotion'
        };
      }
    }

    return {
      valid: true,
      promotion
    };
  }

  /**
   * Calculate discount amount
   */
  public calculateDiscount(
    baseAmount: number,
    promotion: any,
    currency: string
  ): number {
    let discountAmount = 0;

    switch (promotion.discountType) {
      case DiscountType.PERCENTAGE:
        discountAmount = Math.round(baseAmount * (promotion.discountAmount / 100));
        break;

      case DiscountType.FIXED_AMOUNT:
        if (promotion.currency && promotion.currency !== currency) {
          throw new Error('Currency mismatch for fixed amount discount');
        }
        discountAmount = promotion.discountAmount;
        break;

      default:
        throw new Error('Invalid discount type');
    }

    // Apply maximum discount if specified
    if (promotion.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
    }

    return discountAmount;
  }

  /**
   * Record a promotion redemption
   */
  public async recordRedemption(
    promotionId: string,
    customerId: string,
    orderId?: string,
    metadata: Record<string, any> = {}
  ) {
    const redemption = await prisma.promotionRedemption.create({
      data: {
        promotionId,
        customerId,
        orderId,
        metadata
      }
    });

    // Create event
    await createEvent({
      type: 'PROMOTION_REDEEMED',
      resourceType: 'PROMOTION',
      resourceId: promotionId,
      metadata: {
        customerId,
        orderId,
        redemptionId: redemption.id
      }
    });

    return redemption;
  }

  /**
   * Get promotion usage statistics
   */
  public async getPromotionStats(promotionId: string) {
    const [
      redemptions,
      uniqueCustomers,
      totalDiscountAmount
    ] = await Promise.all([
      prisma.promotionRedemption.count({
        where: { promotionId }
      }),
      prisma.promotionRedemption.findMany({
        where: { promotionId },
        select: { customerId: true },
        distinct: ['customerId']
      }),
      prisma.promotionRedemption.aggregate({
        where: { promotionId },
        _sum: { discountAmount: true }
      })
    ]);

    return {
      totalRedemptions: redemptions,
      uniqueCustomers: uniqueCustomers.length,
      totalDiscountAmount: totalDiscountAmount._sum.discountAmount || 0,
      remainingRedemptions: await this.getRemainingRedemptions(promotionId)
    };
  }

  /**
   * Get remaining available redemptions
   */
  private async getRemainingRedemptions(promotionId: string): Promise<number | null> {
    const promotion = await prisma.promotion.findUnique({
      where: { id: promotionId },
      select: { maxRedemptions: true }
    });

    if (!promotion?.maxRedemptions) {
      return null; // Unlimited redemptions
    }

    const usedRedemptions = await prisma.promotionRedemption.count({
      where: { promotionId }
    });

    return Math.max(0, promotion.maxRedemptions - usedRedemptions);
  }

  /**
   * Deactivate a promotion
   */
  public async deactivatePromotion(promotionId: string, reason?: string) {
    const promotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: {
        active: false,
        deactivatedAt: new Date(),
        deactivationReason: reason
      }
    });

    // Create event
    await createEvent({
      type: 'PROMOTION_DEACTIVATED',
      resourceType: 'PROMOTION',
      resourceId: promotionId,
      metadata: {
        reason,
        code: promotion.code
      }
    });

    return promotion;
  }
}