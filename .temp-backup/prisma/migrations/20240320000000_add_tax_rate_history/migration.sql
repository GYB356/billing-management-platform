-- Create tax_rates table if it doesn't exist
CREATE TABLE IF NOT EXISTS "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeId" TEXT,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- Create indexes for tax_rates if they don't exist
CREATE INDEX IF NOT EXISTS "tax_rates_country_state_city_idx" ON "tax_rates"("country", "state", "city");
CREATE INDEX IF NOT EXISTS "tax_rates_organizationId_idx" ON "tax_rates"("organizationId");

-- CreateTable
CREATE TABLE "tax_rate_history" (
    "id" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "tax_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_rate_history_taxRateId_idx" ON "tax_rate_history"("taxRateId");

-- CreateIndex
CREATE INDEX "tax_rate_history_changedAt_idx" ON "tax_rate_history"("changedAt");

-- AddForeignKey
ALTER TABLE "tax_rate_history" ADD CONSTRAINT "tax_rate_history_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE; 