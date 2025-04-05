<<<<<<< HEAD
import { prisma } from "./prisma";
import { TaxRate, Invoice, Customer, TaxExemption } from "@prisma/client";
=======
import { prisma } from "@/lib/prisma";
import { TaxRate } from "@prisma/client";
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9
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

<<<<<<< HEAD
export interface TaxCalculationResult {
  taxRateId: string;
  taxRateName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  isExempt: boolean;
}

export async function calculateInvoiceTaxes(
  invoice: Invoice,
  customer: Customer
): Promise<TaxCalculationResult[]> {
  try {
    // Get all active tax rates for the customer's location
    const taxRates = await prisma.taxRate.findMany({
      where: {
        organizationId: invoice.organizationId,
        country: customer.country,
        state: customer.state,
        city: customer.city,
        isActive: true,
      },
    });

    // Get all valid tax exemptions for the customer
    const taxExemptions = await prisma.taxExemption.findMany({
      where: {
        organizationId: invoice.organizationId,
        customerId: customer.id,
        startDate: {
          lte: invoice.createdAt,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: invoice.createdAt } },
        ],
      },
      include: {
        taxRate: true,
      },
    });

    // Calculate taxes for each tax rate
    const results: TaxCalculationResult[] = [];

    for (const taxRate of taxRates) {
      // Check if there's a valid exemption for this tax rate
      const exemption = taxExemptions.find(
        (ex) => ex.taxRateId === taxRate.id
      );

      const taxableAmount = invoice.subtotal;
      const taxAmount = exemption ? 0 : (taxableAmount * taxRate.rate) / 100;

      results.push({
        taxRateId: taxRate.id,
        taxRateName: taxRate.name,
        taxRate: taxRate.rate,
        taxableAmount,
        taxAmount,
        isExempt: !!exemption,
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating invoice taxes:', error);
    throw error;
  }
}

export async function applyTaxesToInvoice(
  invoiceId: string,
  customerId: string
): Promise<void> {
  try {
    // Get invoice and customer details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice || !invoice.customer) {
      throw new Error('Invoice or customer not found');
    }

    // Calculate taxes
    const taxCalculations = await calculateInvoiceTaxes(
      invoice,
      invoice.customer
    );

    // Create tax records and update invoice total
    const totalTaxAmount = taxCalculations.reduce(
      (sum, calc) => sum + calc.taxAmount,
      0
    );

    // Create tax records
    await Promise.all(
      taxCalculations.map((calc) =>
        prisma.invoiceTax.create({
          data: {
            invoiceId,
            taxRateId: calc.taxRateId,
            amount: calc.taxAmount,
            isExempt: calc.isExempt,
          },
        })
      )
    );

    // Update invoice total
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        total: invoice.subtotal + totalTaxAmount,
      },
    });
  } catch (error) {
    console.error('Error applying taxes to invoice:', error);
    throw error;
  }
}

export async function getTaxSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  taxRateId: string;
  taxRateName: string;
  taxRate: number;
  totalAmount: number;
  invoiceCount: number;
}[]> {
  try {
    // Get all invoice tax records for the period
    const invoiceTaxes = await prisma.invoiceTax.findMany({
      where: {
        invoice: {
          organizationId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        taxRate: true,
      },
    });

    // Group by tax rate and calculate totals
    const summary = invoiceTaxes.reduce((acc, curr) => {
      const existing = acc.find((item) => item.taxRateId === curr.taxRateId);

      if (existing) {
        existing.totalAmount += curr.amount;
        existing.invoiceCount += 1;
      } else {
        acc.push({
          taxRateId: curr.taxRateId,
          taxRateName: curr.taxRate.name,
          taxRate: curr.taxRate.rate,
          totalAmount: curr.amount,
          invoiceCount: 1,
        });
      }

      return acc;
    }, [] as {
      taxRateId: string;
      taxRateName: string;
      taxRate: number;
      totalAmount: number;
      invoiceCount: number;
    }[]);

    return summary;
  } catch (error) {
    console.error('Error getting tax summary:', error);
    throw error;
  }
}

export async function validateTaxExemption(
  customerId: string,
  taxRateId: string,
  date: Date
): Promise<boolean> {
  try {
    const exemption = await prisma.taxExemption.findFirst({
      where: {
        customerId,
        taxRateId,
        startDate: {
          lte: date,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: date } },
        ],
      },
    });

    return !!exemption;
  } catch (error) {
    console.error('Error validating tax exemption:', error);
    throw error;
  }
}

export async function getTaxRatesByLocation(
  organizationId: string,
  country: string,
  state?: string,
  city?: string
): Promise<{
  id: string;
  name: string;
  rate: number;
  country: string;
  state?: string;
  city?: string;
}[]> {
  try {
    const taxRates = await prisma.taxRate.findMany({
      where: {
        organizationId,
        country,
        ...(state && { state }),
        ...(city && { city }),
        isActive: true,
      },
      orderBy: {
        rate: 'desc',
      },
      select: {
        id: true,
        name: true,
        rate: true,
        country: true,
        state: true,
        city: true,
      },
    });

    return taxRates;
  } catch (error) {
    console.error('Error getting tax rates by location:', error);
    throw error;
  }
} 
=======
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
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9
