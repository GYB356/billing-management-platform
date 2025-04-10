import prisma from '@/lib/prisma';
import { generateUsageReport } from '@/lib/usage/report';
import { createInvoice, finalizeInvoice } from '@/lib/billing/invoice';
import { addMonths, startOfMonth, endOfMonth, format } from 'date-fns';

interface BillableFeature {
  id: string;
  name: string;
  usage: number;
  unitPrice: number;
  totalAmount: number;
  period: {
    start: Date;
    end: Date;
  };
}

export async function processMonthlyBilling() {
  const now = new Date();
  const periodStart = startOfMonth(addMonths(now, -1)); // Previous month start
  const periodEnd = endOfMonth(addMonths(now, -1)); // Previous month end

  // Get all active subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
    },
    include: {
      customer: true,
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: true,
            },
          },
          pricingTiers: true,
        },
      },
    },
  });

  for (const subscription of subscriptions) {
    try {
      // Generate usage report
      const report = await generateUsageReport({
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
      });

      // Calculate billable features
      const billableFeatures: BillableFeature[] = [];
      const features = JSON.parse(report.features as string);

      for (const feature of features) {
        const planFeature = subscription.plan.planFeatures.find(
          (pf) => pf.feature.name === feature.name
        );

        if (!planFeature) continue;

        // Find applicable pricing tier
        const pricingTier = subscription.plan.pricingTiers
          .filter((tier) => !tier.upTo || tier.upTo >= feature.usage)
          .sort((a, b) => (a.upTo || Infinity) - (b.upTo || Infinity))[0];

        if (pricingTier) {
          const unitPrice = pricingTier.perUnitFee || 0;
          const flatFee = pricingTier.flatFee || 0;
          const totalAmount = feature.usage * unitPrice + flatFee;

          if (totalAmount > 0) {
            billableFeatures.push({
              id: planFeature.feature.id,
              name: feature.name,
              usage: feature.usage,
              unitPrice,
              totalAmount,
              period: {
                start: periodStart,
                end: periodEnd,
              },
            });
          }
        }
      }

      // Create invoice if there are billable features
      if (billableFeatures.length > 0 || subscription.plan.basePrice > 0) {
        const invoiceItems = [
          // Base subscription fee
          ...(subscription.plan.basePrice > 0
            ? [
                {
                  description: `${subscription.plan.name} - Monthly Subscription`,
                  amount: subscription.plan.basePrice,
                  quantity: 1,
                  period: {
                    start: periodStart,
                    end: periodEnd,
                  },
                },
              ]
            : []),
          // Usage-based fees
          ...billableFeatures.map((feature) => ({
            description: `${feature.name} Usage (${feature.usage} units)`,
            amount: feature.unitPrice,
            quantity: feature.usage,
            period: feature.period,
          })),
        ];

        const invoice = await createInvoice({
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          items: invoiceItems,
          dueDate: addMonths(now, 1), // Due in 30 days
          periodStart,
          periodEnd,
          notes: `Monthly invoice for ${format(periodStart, 'MMMM yyyy')}`,
        });

        // Finalize the invoice
        await finalizeInvoice(invoice.id);

        // Record the billing attempt
        await prisma.billingAttempt.create({
          data: {
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            status: 'SUCCEEDED',
            attemptedAt: now,
          },
        });
      }
    } catch (error) {
      console.error(
        `Error processing monthly billing for subscription ${subscription.id}:`,
        error
      );

      // Record the failed attempt
      await prisma.billingAttempt.create({
        data: {
          subscriptionId: subscription.id,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          attemptedAt: now,
        },
      });
    }
  }
}

// Function to retry failed billing attempts
export async function retryFailedBilling(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      billingAttempts: {
        orderBy: {
          attemptedAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new Error('Subscription not found or not active');
  }

  const lastAttempt = subscription.billingAttempts[0];
  if (!lastAttempt || lastAttempt.status !== 'FAILED') {
    throw new Error('No failed billing attempt found');
  }

  // Retry the billing process
  await processMonthlyBilling();
}
