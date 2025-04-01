import { prisma } from "@/lib/prisma";
import { TaxRate } from "@prisma/client";
import { stripe } from "./stripe";
import { createEvent, EventSeverity } from "./events";

/**
 * Get applicable tax rate for a country and state
 */
export async function getTaxRate(
  country: string,
  state?: string | null
): Promise<TaxRate | null> {
  // Try to find an exact match with country and state
  if (state) {
    const exactMatch = await prisma.taxRate.findFirst({
      where: {
        country,
        state,
        active: true,
      },
    });

    if (exactMatch) {
      return exactMatch;
    }
  }

  // Fall back to country-level tax rate
  const countryRate = await prisma.taxRate.findFirst({
    where: {
      country,
      state: null,
      active: true,
    },
  });

  return countryRate;
}

/**
 * Calculate tax amount for a given price
 */
export function calculateTaxAmount(
  priceInCents: number,
  taxRate: number | null
): number {
  if (!taxRate) return 0;
  
  return Math.round((priceInCents * taxRate) / 100);
}

/**
 * Create or update a tax rate
 */
export async function createOrUpdateTaxRate({
  name,
  description,
  percentage,
  country,
  state = null,
  active = true,
}: {
  name: string;
  description?: string;
  percentage: number;
  country: string;
  state?: string | null;
  active?: boolean;
}): Promise<TaxRate> {
  // Check if tax rate already exists for this country/state
  const existingTaxRate = await prisma.taxRate.findFirst({
    where: {
      country,
      state: state || null,
    },
  });

  // Create tax rate in Stripe
  let stripeTaxRateId = existingTaxRate?.stripeId;
  
  try {
    if (!stripeTaxRateId) {
      // Create new Stripe tax rate
      const stripeTaxRate = await stripe.taxRates.create({
        display_name: name,
        description: description || "",
        percentage: percentage,
        inclusive: false, // Tax is calculated on top of the price
        active,
        country,
        state,
      });
      stripeTaxRateId = stripeTaxRate.id;
    } else if (existingTaxRate) {
      // Update existing Stripe tax rate (can only update display name and active status)
      await stripe.taxRates.update(stripeTaxRateId, {
        active,
        display_name: name,
      });
    }
  } catch (error) {
    console.error("Error managing Stripe tax rate:", error);
    // Continue to manage our local tax rate even if Stripe fails
  }

  // Create or update in our database
  let taxRate: TaxRate;
  
  if (existingTaxRate) {
    taxRate = await prisma.taxRate.update({
      where: { id: existingTaxRate.id },
      data: {
        name,
        description,
        percentage,
        active,
        stripeId: stripeTaxRateId,
      },
    });
  } else {
    taxRate = await prisma.taxRate.create({
      data: {
        name,
        description,
        percentage,
        country,
        state,
        active,
        stripeId: stripeTaxRateId,
      },
    });
  }

  // Log the event
  await createEvent({
    eventType: existingTaxRate ? "TAX_RATE_UPDATED" : "TAX_RATE_CREATED",
    resourceType: "TAX_RATE",
    resourceId: taxRate.id,
    severity: EventSeverity.INFO,
    metadata: {
      country,
      state,
      percentage,
      active,
    },
  });

  return taxRate;
}

/**
 * Get all tax rates with optional filtering
 */
export async function getTaxRates({
  active,
  country,
}: {
  active?: boolean;
  country?: string;
} = {}): Promise<TaxRate[]> {
  const whereClause: any = {};
  
  if (active !== undefined) {
    whereClause.active = active;
  }
  
  if (country) {
    whereClause.country = country;
  }
  
  return prisma.taxRate.findMany({
    where: whereClause,
    orderBy: [
      { country: "asc" },
      { state: "asc" },
    ],
  });
}

/**
 * Get tax settings for an organization
 */
export async function getOrganizationTaxSettings(
  organizationId: string
): Promise<{ taxExempt: boolean; taxId?: string; taxCountry?: string; taxState?: string }> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${organizationId} not found`);
  }

  // Extract tax settings from organization
  const settings = organization.settings as Record<string, any> || {};
  
  return {
    taxExempt: settings.taxExempt || false,
    taxId: organization.taxId || settings.taxId,
    taxCountry: settings.taxCountry,
    taxState: settings.taxState,
  };
}

/**
 * Update organization tax settings
 */
export async function updateOrganizationTaxSettings(
  organizationId: string,
  {
    taxExempt,
    taxId,
    taxCountry,
    taxState,
  }: {
    taxExempt?: boolean;
    taxId?: string;
    taxCountry?: string;
    taxState?: string;
  }
): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${organizationId} not found`);
  }

  // Current settings
  const currentSettings = organization.settings as Record<string, any> || {};
  
  // Update settings
  const updatedSettings = {
    ...currentSettings,
    ...(taxExempt !== undefined && { taxExempt }),
    ...(taxCountry && { taxCountry }),
    ...(taxState && { taxState }),
  };

  // Update in database
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      taxId: taxId || organization.taxId,
      settings: updatedSettings,
    },
  });

  // Update in Stripe if customer exists
  if (organization.stripeCustomerId) {
    try {
      await stripe.customers.update(organization.stripeCustomerId, {
        tax_exempt: taxExempt ? "exempt" : "none",
        tax_id_data: taxId
          ? [
              {
                type: "eu_vat", // This should be dynamically determined based on country
                value: taxId,
              },
            ]
          : undefined,
      });
    } catch (error) {
      console.error("Error updating Stripe customer tax settings:", error);
      // Continue even if Stripe update fails
    }
  }

  // Log the event
  await createEvent({
    organizationId,
    eventType: "TAX_SETTINGS_UPDATED",
    resourceType: "ORGANIZATION",
    resourceId: organizationId,
    severity: EventSeverity.INFO,
    metadata: {
      taxExempt,
      taxId,
      taxCountry,
      taxState,
    },
  });
}

/**
 * Calculate tax for a subscription
 */
export async function calculateSubscriptionTax({
  organizationId,
  planId,
  couponId,
}: {
  organizationId: string;
  planId: string;
  couponId?: string;
}): Promise<{
  subtotal: number;
  taxAmount: number;
  taxRate: number | null;
  total: number;
  taxExempt: boolean;
}> {
  // Get organization
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${organizationId} not found`);
  }

  // Get tax settings
  const taxSettings = await getOrganizationTaxSettings(organizationId);

  // Get pricing plan
  const plan = await prisma.pricingPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Pricing plan with ID ${planId} not found`);
  }

  // If tax exempt, return no tax
  if (taxSettings.taxExempt) {
    return {
      subtotal: plan.price,
      taxAmount: 0,
      taxRate: null,
      total: plan.price,
      taxExempt: true,
    };
  }

  // Apply coupon discount if applicable
  let subtotal = plan.price;
  
  if (couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: { promotion: true },
    });
    
    if (coupon && coupon.active && coupon.promotion.active) {
      if (coupon.promotion.discountType === "PERCENTAGE") {
        subtotal -= Math.round((plan.price * coupon.promotion.discountAmount) / 100);
      } else {
        subtotal -= coupon.promotion.discountAmount;
      }
      
      // Ensure subtotal is not negative
      subtotal = Math.max(0, subtotal);
    }
  }

  // Get applicable tax rate
  const taxRate = taxSettings.taxCountry
    ? await getTaxRate(taxSettings.taxCountry, taxSettings.taxState)
    : null;

  // Calculate tax
  const taxAmount = taxRate
    ? Math.round((subtotal * taxRate.percentage) / 100)
    : 0;

  return {
    subtotal,
    taxAmount,
    taxRate: taxRate ? taxRate.percentage : null,
    total: subtotal + taxAmount,
    taxExempt: false,
  };
}

/**
 * Add tax exemption certificate for an organization
 */
export async function addTaxExemptionCertificate(organizationId: string, certificateUrl: string) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      taxExemptionCertificate: certificateUrl,
    },
  });
}

/**
 * Validate tax exemption for an organization
 */
export async function validateTaxExemption(organizationId: string): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  return !!organization?.taxExemptionCertificate;
}