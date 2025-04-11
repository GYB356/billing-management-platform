import { 
  PricingPlan, 
  PricingTier, 
  BillingPromotion, 
  BillingInterval,
  PromotionType,
  UsageMetric,
  UsageTier,
  UsageRecord
} from '../types/pricing';

export interface PricingOptions {
  quantity?: number;
  usageRecords?: UsageRecord[];
  billingInterval?: BillingInterval;
  promotions?: BillingPromotion[];
  currency?: string;
  region?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  quantity: number;
  subtotal: number;
  discounts: Array<{
    name: string;
    type: PromotionType;
    amount: number;
  }>;
  totalDiscount: number;
  usageCharges: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalUsage: number;
  total: number;
  formattedTotal: string;
}

/**
 * Calculate the price for a given plan with options
 */
export function calculatePrice(
  plan: PricingPlan,
  options: PricingOptions = {}
): PriceBreakdown {
  const {
    quantity = 1,
    usageRecords = [],
    billingInterval = plan.billingInterval as BillingInterval,
    promotions = [],
    currency = plan.currency,
    region = 'US'
  } = options;

  // Start with the base breakdown
  const breakdown: PriceBreakdown = {
    basePrice: plan.basePrice,
    quantity,
    subtotal: 0,
    discounts: [],
    totalDiscount: 0,
    usageCharges: [],
    totalUsage: 0,
    total: 0,
    formattedTotal: ''
  };

  // Calculate the base price based on the pricing type
  if (plan.pricingType === 'flat') {
    breakdown.subtotal = plan.basePrice;
  } else if (plan.pricingType === 'per_user') {
    breakdown.subtotal = plan.basePrice * quantity;
  } else if (plan.pricingType === 'tiered' && plan.pricingTiers && plan.pricingTiers.length > 0) {
    // Find the appropriate tier
    const tier = findApplicableTier(plan.pricingTiers, quantity);
    
    if (tier) {
      breakdown.subtotal = (tier.flatFee || 0) + (tier.unitPrice * quantity);
    } else {
      // Fallback to base price if no tier matches
      breakdown.subtotal = plan.basePrice * quantity;
    }
  }

  // Apply billing interval multiplier
  const intervalMultiplier = getBillingIntervalMultiplier(billingInterval);
  breakdown.subtotal = breakdown.subtotal * intervalMultiplier;

  // Calculate usage charges if applicable
  if (plan.pricingType === 'usage_based' && usageRecords && usageRecords.length > 0) {
    const usageCharges = calculateUsageCharges(usageRecords);
    breakdown.usageCharges = usageCharges;
    breakdown.totalUsage = usageCharges.reduce((sum, charge) => sum + charge.total, 0);
  }

  // Apply promotions and calculate discounts
  if (promotions && promotions.length > 0) {
    const applicablePromotions = promotions.filter(
      promo => 
        promo.isActive && 
        (promo.appliesTo.planIds.includes(plan.id) || 
         plan.features.some(f => promo.appliesTo.featureIds.includes(f.featureId)))
    );

    // Sort by stackable first
    const sortedPromotions = [...applicablePromotions].sort((a, b) => 
      (a.isStackable === b.isStackable) ? 0 : a.isStackable ? -1 : 1
    );

    let subtotalAfterDiscount = breakdown.subtotal;
    let appliedNonStackable = false;

    for (const promo of sortedPromotions) {
      // Skip non-stackable promotions if we already applied one
      if (!promo.isStackable && appliedNonStackable) {
        continue;
      }

      const discountAmount = calculateDiscount(promo, subtotalAfterDiscount);
      
      breakdown.discounts.push({
        name: promo.name,
        type: promo.promotionType as PromotionType,
        amount: discountAmount
      });

      subtotalAfterDiscount -= discountAmount;
      
      if (!promo.isStackable) {
        appliedNonStackable = true;
      }
    }

    breakdown.totalDiscount = breakdown.discounts.reduce((sum, discount) => sum + discount.amount, 0);
  }

  // Calculate final price
  breakdown.total = breakdown.subtotal - breakdown.totalDiscount + breakdown.totalUsage;
  
  // Format the total
  breakdown.formattedTotal = formatPrice(breakdown.total, currency);

  return breakdown;
}

/**
 * Find the applicable pricing tier based on quantity
 */
function findApplicableTier(tiers: PricingTier[], quantity: number): PricingTier | undefined {
  return tiers.find(
    tier => quantity >= tier.minQuantity && (!tier.maxQuantity || quantity <= tier.maxQuantity)
  );
}

/**
 * Get the multiplier for different billing intervals
 */
function getBillingIntervalMultiplier(interval: BillingInterval): number {
  switch (interval) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'annual':
      return 12;
    case 'custom':
      return 1; // Custom intervals would need specific handling
    default:
      return 1;
  }
}

/**
 * Calculate usage charges based on usage records
 */
function calculateUsageCharges(usageRecords: UsageRecord[]): Array<{
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}> {
  // Group usage records by metric
  const usageByMetric = usageRecords.reduce((acc, record) => {
    const { metricId, quantity } = record;
    if (!acc[metricId]) {
      acc[metricId] = {
        metric: record.metric,
        totalQuantity: 0
      };
    }
    
    acc[metricId].totalQuantity += quantity;
    return acc;
  }, {} as Record<string, { metric: UsageMetric; totalQuantity: number }>);

  // Calculate charges for each metric
  return Object.values(usageByMetric).map(({ metric, totalQuantity }) => {
    const tier = findApplicableUsageTier(metric.tiers, totalQuantity);
    const unitPrice = tier ? tier.unitPrice : 0;
    const flatFee = tier ? tier.flatFee || 0 : 0;
    
    return {
      name: metric.name,
      quantity: totalQuantity,
      unitPrice,
      total: flatFee + (unitPrice * totalQuantity)
    };
  });
}

/**
 * Find the applicable usage tier based on quantity
 */
function findApplicableUsageTier(tiers: UsageTier[], quantity: number): UsageTier | undefined {
  return tiers.find(
    tier => quantity >= tier.minQuantity && (!tier.maxQuantity || quantity <= tier.maxQuantity)
  );
}

/**
 * Calculate discount amount based on promotion and subtotal
 */
function calculateDiscount(promotion: BillingPromotion, subtotal: number): number {
  switch (promotion.promotionType) {
    case 'percentage':
      return Math.round(subtotal * (promotion.value / 100));
    case 'fixed_amount':
      return Math.min(promotion.value, subtotal); // Can't discount more than the subtotal
    case 'free_period':
      // For free period, we'd need more context about the billing cycle
      // This is a simplified version
      return subtotal; // Assumes full period is free
    default:
      return 0;
  }
}

/**
 * Format price amount based on currency
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  // Get currency symbol
  const currencySymbol = 
    currency === 'USD' ? '$' :
    currency === 'EUR' ? '€' :
    currency === 'GBP' ? '£' :
    currency === 'CAD' ? 'CA$' :
    currency === 'AUD' ? 'A$' :
    currency === 'JPY' ? '¥' : '$';
    
  // Format with appropriate decimals
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  });
  
  const formattedAmount = formatter.format(amount / 100); // Convert cents to dollars
  return `${currencySymbol}${formattedAmount}`;
}

/**
 * Calculate prorated price based on days remaining in billing cycle
 */
export function calculateProratedPrice(
  originalPrice: number,
  totalDays: number,
  remainingDays: number
): number {
  if (remainingDays <= 0 || totalDays <= 0) {
    return 0;
  }
  
  return Math.round((originalPrice * remainingDays) / totalDays);
}

/**
 * Calculate tax amount based on price and rate
 */
export function calculateTax(price: number, taxRate: number): number {
  return Math.round(price * (taxRate / 100));
}

/**
 * Convert price between currencies based on exchange rate
 */
export function convertCurrency(
  price: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): number {
  return Math.round(price * exchangeRate);
} 