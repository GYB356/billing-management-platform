-- Create organization table if it doesn't exist
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "taxId" TEXT,
    "settings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes for organization
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_email_key" ON "organizations"("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

-- CreateTable
CREATE TABLE "tax_report_cache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_report_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_report_cache_organizationId_idx" ON "tax_report_cache"("organizationId");

-- CreateIndex
CREATE INDEX "tax_report_cache_period_idx" ON "tax_report_cache"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "tax_report_cache" ADD CONSTRAINT "tax_report_cache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; 