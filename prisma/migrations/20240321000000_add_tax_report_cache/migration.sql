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
ALTER TABLE "tax_report_cache" ADD CONSTRAINT "tax_report_cache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; 