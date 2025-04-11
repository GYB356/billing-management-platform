import { prisma } from "@/lib/prisma";
import { getCachedTaxRate } from "./tax-cache";

export async function getTaxRateForUser(userId: string, country: string, region?: string) {
  // Check for tax exemption
  const exemption = await prisma.taxExemption.findUnique({ where: { userId } });
  if (exemption) return 0;

  // Get cached rate
  const rate = await getCachedTaxRate(country, region);
  return rate;
}

export async function calculateTaxAmount(price: number, country: string, region?: string, userId?: string) {
  const rate = await getTaxRateForUser(userId || 'system', country, region);
  return Math.round(price * rate); // Round to nearest integer for cents
}

export async function getTaxRateFromDatabase(country: string, region?: string) {
  let rate = await prisma.taxRate.findFirst({
    where: {
      country,
      region: region || null,
    },
  });

  if (!rate) {
    rate = await prisma.taxRate.findFirst({
      where: {
        country,
        isDefault: true,
      },
    });
  }

  return rate?.rate ?? 0;
} 