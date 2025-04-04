/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the `PlanFeature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanFeatureAssociation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingPromotion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingTier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromotionFeature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromotionPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromotionRedemption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UsageRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UsageTier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `coupons` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `one_time_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organizations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `processed_webhook_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `promotions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tax_rates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_organizations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PlanFeatureAssociation" DROP CONSTRAINT "PlanFeatureAssociation_featureId_fkey";

-- DropForeignKey
ALTER TABLE "PlanFeatureAssociation" DROP CONSTRAINT "PlanFeatureAssociation_planId_fkey";

-- DropForeignKey
ALTER TABLE "PricingTier" DROP CONSTRAINT "PricingTier_planId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionFeature" DROP CONSTRAINT "PromotionFeature_featureId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionFeature" DROP CONSTRAINT "PromotionFeature_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionPlan" DROP CONSTRAINT "PromotionPlan_planId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionPlan" DROP CONSTRAINT "PromotionPlan_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionRedemption" DROP CONSTRAINT "PromotionRedemption_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionRedemption" DROP CONSTRAINT "PromotionRedemption_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_pricingPlanId_fkey";

-- DropForeignKey
ALTER TABLE "UsageRecord" DROP CONSTRAINT "UsageRecord_featureId_fkey";

-- DropForeignKey
ALTER TABLE "UsageRecord" DROP CONSTRAINT "UsageRecord_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "UsageTier" DROP CONSTRAINT "UsageTier_featureId_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "one_time_payments" DROP CONSTRAINT "one_time_payments_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_organizations" DROP CONSTRAINT "user_organizations_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "user_organizations" DROP CONSTRAINT "user_organizations_userId_fkey";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "users_stripeCustomerId_key";

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "metadata",
DROP COLUMN "password",
DROP COLUMN "role",
DROP COLUMN "status",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "PlanFeature";

-- DropTable
DROP TABLE "PlanFeatureAssociation";

-- DropTable
DROP TABLE "PricingPlan";

-- DropTable
DROP TABLE "PricingPromotion";

-- DropTable
DROP TABLE "PricingTier";

-- DropTable
DROP TABLE "PromotionFeature";

-- DropTable
DROP TABLE "PromotionPlan";

-- DropTable
DROP TABLE "PromotionRedemption";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "UsageRecord";

-- DropTable
DROP TABLE "UsageTier";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "coupons";

-- DropTable
DROP TABLE "events";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "one_time_payments";

-- DropTable
DROP TABLE "organizations";

-- DropTable
DROP TABLE "processed_webhook_events";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "promotions";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "tax_rates";

-- DropTable
DROP TABLE "user_organizations";

-- DropTable
DROP TABLE "verification_tokens";

-- DropEnum
DROP TYPE "DiscountType";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "OrganizationRole";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "UserRole";

-- DropEnum
DROP TYPE "UserStatus";
