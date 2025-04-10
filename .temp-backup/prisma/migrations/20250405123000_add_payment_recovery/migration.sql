-- Add payment attempt tracking
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- Add dunning configuration
CREATE TABLE "dunning_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "stepsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dunning_configs_pkey" PRIMARY KEY ("id")
);

-- Add dunning execution log
CREATE TABLE "dunning_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "daysPastDue" INTEGER NOT NULL,
    "actions" TEXT[] NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dunning_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dunning_configs" ADD CONSTRAINT "dunning_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dunning_logs" ADD CONSTRAINT "dunning_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dunning_logs" ADD CONSTRAINT "dunning_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dunning_logs" ADD CONSTRAINT "dunning_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "payment_attempts_subscriptionId_idx" ON "payment_attempts"("subscriptionId");
CREATE INDEX "payment_attempts_invoiceId_idx" ON "payment_attempts"("invoiceId");
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");
CREATE INDEX "payment_attempts_scheduledFor_idx" ON "payment_attempts"("scheduledFor");

CREATE INDEX "dunning_configs_organizationId_idx" ON "dunning_configs"("organizationId");
CREATE UNIQUE INDEX "dunning_configs_organizationId_active_key" ON "dunning_configs"("organizationId", "isActive") WHERE "isActive" = true;

CREATE INDEX "dunning_logs_subscriptionId_idx" ON "dunning_logs"("subscriptionId");
CREATE INDEX "dunning_logs_invoiceId_idx" ON "dunning_logs"("invoiceId");
CREATE INDEX "dunning_logs_customerId_idx" ON "dunning_logs"("customerId");
CREATE INDEX "dunning_logs_createdAt_idx" ON "dunning_logs"("createdAt");

-- Add subscription suspension support
ALTER TABLE "subscriptions" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- Add invoice payment tracking
ALTER TABLE "invoices" ADD COLUMN "lastPaymentError" TEXT;