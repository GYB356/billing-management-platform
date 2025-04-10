-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BillingInterval" ADD VALUE 'QUARTERLY';
ALTER TYPE "BillingInterval" ADD VALUE 'WEEKLY';
ALTER TYPE "BillingInterval" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "customFields" JSONB DEFAULT '{}',
ADD COLUMN     "discount" INTEGER,
ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "invoiceTemplate" TEXT,
ADD COLUMN     "oneTimePaymentId" TEXT,
ADD COLUMN     "taxAmount" INTEGER,
ADD COLUMN     "taxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "billingCycles" INTEGER,
ADD COLUMN     "comparePosition" INTEGER,
ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupFee" INTEGER,
ADD COLUMN     "supportedCurrencies" TEXT[] DEFAULT ARRAY['USD']::TEXT[],
ADD COLUMN     "tier" "PricingTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "trialReminders" JSONB DEFAULT '{"days": [1, 3, 7]}';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "appliedDiscountAmount" INTEGER,
ADD COLUMN     "appliedDiscountPercent" INTEGER,
ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "trialConvertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "applicablePlans" TEXT[],
    "stripeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paymentMethod" TEXT,
    "stripeId" TEXT,
    "invoiceId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_time_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_stripeId_key" ON "promotions"("stripeId");

-- CreateIndex
CREATE INDEX "promotions_active_idx" ON "promotions"("active");

-- CreateIndex
CREATE INDEX "promotions_startDate_endDate_idx" ON "promotions"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_promotionId_idx" ON "coupons"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_payments_stripeId_key" ON "one_time_payments"("stripeId");

-- CreateIndex
CREATE INDEX "one_time_payments_organizationId_idx" ON "one_time_payments"("organizationId");

-- CreateIndex
CREATE INDEX "one_time_payments_status_idx" ON "one_time_payments"("status");

-- CreateIndex
CREATE INDEX "one_time_payments_createdAt_idx" ON "one_time_payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_stripeId_key" ON "tax_rates"("stripeId");

-- CreateIndex
CREATE INDEX "tax_rates_country_idx" ON "tax_rates"("country");

-- CreateIndex
CREATE INDEX "tax_rates_active_idx" ON "tax_rates"("active");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_country_state_key" ON "tax_rates"("country", "state");

-- CreateIndex
CREATE INDEX "subscriptions_couponId_idx" ON "subscriptions"("couponId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_payments" ADD CONSTRAINT "one_time_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
