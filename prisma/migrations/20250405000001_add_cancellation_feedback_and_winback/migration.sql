-- CreateTable
CREATE TABLE "subscription_cancellation_feedback" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "additionalFeedback" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_cancellation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "win_back_campaigns" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "offer" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "win_back_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_emails" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_cancellation_feedback_subscriptionId_idx" ON "subscription_cancellation_feedback"("subscriptionId");

-- CreateIndex
CREATE INDEX "win_back_campaigns_subscriptionId_idx" ON "win_back_campaigns"("subscriptionId");

-- CreateIndex
CREATE INDEX "win_back_campaigns_organizationId_idx" ON "win_back_campaigns"("organizationId");

-- CreateIndex
CREATE INDEX "scheduled_emails_organizationId_idx" ON "scheduled_emails"("organizationId");

-- CreateIndex
CREATE INDEX "scheduled_emails_scheduledFor_idx" ON "scheduled_emails"("scheduledFor");

-- AddForeignKey
ALTER TABLE "subscription_cancellation_feedback" ADD CONSTRAINT "subscription_cancellation_feedback_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_back_campaigns" ADD CONSTRAINT "win_back_campaigns_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_back_campaigns" ADD CONSTRAINT "win_back_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;