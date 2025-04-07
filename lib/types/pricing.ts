export type BillingInterval = 'monthly' | 'quarterly' | 'annual' | 'custom';
export type PricingType = 'flat' | 'per_user' | 'tiered' | 'usage_based';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';
export type FeatureAccessType = 'full' | 'limited' | 'none';
export type PromotionType = 'percentage' | 'fixed_amount' | 'free_period';

export enum FeatureStatus {
  BETA = 'BETA',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  COMING_SOON = 'COMING_SOON'
}

// Base pricing plan interface
export interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  pricingType: 'flat' | 'per_user' | 'tiered' | 'usage_based';
  basePrice: number;
  currency: 'USD' | 'EUR' | 'GBP';
  billingInterval: 'monthly' | 'quarterly' | 'annual' | 'custom';
  trialDays: number;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  tiers: PricingTier[];
  planFeatures: PlanFeatureAssociation[];
}

// Version tracking for pricing plans
export interface PricingPlanVersion extends PricingPlan {
  versionId: string;
  versionNumber: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  previousVersionId?: string;
  changeReason?: string;
}

// Feature definition for plans
export interface PlanFeature {
  id: string;
  name: string;
  description: string | null;
  unitName: string | null;
  isHighlighted: boolean;
  status: FeatureStatus; // Add this
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Feature package/bundle
export interface FeaturePackage {
  id: string;
  name: string;
  description: string;
  features: PlanFeature[];
  isActive: boolean;
}

// Tiered pricing structure
export interface PricingTier {
  id: string;
  planId: string;
  upTo: number | null;
  price: number | null;
  flatFee: number | null;
  perUnitFee: number | null;
  infinite: boolean;
}

// Usage based pricing metrics
export interface UsageMetric {
  id: string;
  name: string;
  description: string;
  unitName: string;
  aggregationType: 'count' | 'sum' | 'max' | 'unique';
  pricingTiers: UsageTier[];
}

export interface UsageTier {
  id: string;
  featureId: string;
  upTo: number | null;
  price: number | null;
  flatFee: number | null;
  perUnitFee: number | null;
  infinite: boolean;
}

// Promotional pricing and discounts
export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  promotionType: PromotionType;
  value: number; // Percentage, fixed amount, or days for free period
  maxRedemptions?: number;
  redemptionCount: number;
  isActive: boolean;
  isStackable: boolean;
  appliesTo: {
    planIds: string[];
    featureIds: string[];
  };
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Custom billing periods
export interface CustomBillingPeriod {
  id: string;
  planId: string;
  intervalDays: number;
  name: string;
}

// Regional pricing configuration
export interface RegionalPricing {
  id: string;
  planId: string;
  region: string;
  currencyCode: CurrencyCode;
  basePrice: number;
  exchangeRate: number;
  isAutoUpdated: boolean;
  lastUpdatedAt: Date;
}

// Tax configuration
export interface TaxConfiguration {
  id: string;
  region: string;
  taxType: 'VAT' | 'SALES_TAX' | 'GST';
  rate: number;
  isActive: boolean;
  appliesTo: {
    planIds: string[];
    featureIds: string[];
  };
}

export interface PlanFeatureAssociation {
  id: string;
  planId: string;
  featureId: string;
  feature: PlanFeature;
}

export interface PricingPromotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed' | 'free_trial';
  discountValue: number;
  maxRedemptions: number | null;
  timesRedeemed: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  isStackable: boolean;
  createdAt: string;
  updatedAt: string;
  applicablePlans: string[] | null;
  applicableFeatures: string[] | null;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  discountDetails: {
    promotionId: string;
    promotionName: string;
    amount: number;
  }[];
  tax: number;
  taxDetails: {
    name: string;
    rate: number;
    amount: number;
  }[];
  total: number;
  proration: number;
  currency: string;
  formattedSubtotal: string;
  formattedDiscount: string;
  formattedTax: string;
  formattedTotal: string;
  formattedProration: string;
  billingPeriod: {
    start: string;
    end: string;
  };
}

export interface PricingOptions {
  quantity?: number;
  usageRecords?: {
    featureId: string;
    quantity: number;
  }[];
  billingInterval?: 'monthly' | 'quarterly' | 'annual' | 'custom';
  promotions?: string[];
  currency?: 'USD' | 'EUR' | 'GBP';
  region?: string;
  subscriptionId?: string;
  includeUpcoming?: boolean;
}

export interface SubscriptionUpgradeOptions {
  currentPlanId: string;
  newPlanId: string;
  newQuantity?: number;
  immediateChange?: boolean;
  prorationDate?: number;
  preserveTermEnd?: boolean;
}