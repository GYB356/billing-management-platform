import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { sendTrialExpiryEmail } from '@/lib/email';
import { SubscriptionStatus } from '@prisma/client';

// Verify cron secret to ensure only authorized calls
const verifyCronSecret = (request: Request) => {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    throw new Error('CRON_SECRET is not configured');
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    throw new Error('Unauthorized');
  }
};

export async function POST(request: Request) {
  try {
    // Verify the request is from our cron service
    verifyCronSecret(request);

    const now = new Date();
    let processedCount = 0;
    let errorCount = 0;
    const errors: Array<{ subscriptionId: string; error: string }> = [];

    // Find subscriptions with expired trials
    const expiringSubs = await prisma.subscription.findMany({
      where: {
        trialEndsAt: {
          lt: now,
        },
        status: SubscriptionStatus.TRIALING,
      },
      include: {
        customerProfile: {
          select: {
            email: true,
            name: true,
            customerId: true, // Stripe customer ID
          },
        },
        plan: true,
      },
    });

    for (const sub of expiringSubs) {
      try {
        // Update subscription in Stripe using the plan's Stripe ID
        const updatedStripeSub = await stripe.subscriptions.update(sub.metadata?.stripeSubscriptionId as string, {
          trial_end: 'now',
          collection_method: 'charge_automatically',
        });

        // Update subscription in database
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            trialEndsAt: null,
            currentPeriodStart: new Date(updatedStripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(updatedStripeSub.current_period_end * 1000),
            metadata: {
              ...sub.metadata,
              lastBillingSync: new Date().toISOString(),
            },
          },
        });

        // Create billing record for the trial end
        await prisma.billingRecord.create({
          data: {
            organizationId: sub.organizationId,
            customerId: sub.customerId,
            subscriptionId: sub.id,
            type: 'CHARGE',
            amount: sub.plan.price,
            currency: sub.plan.currency,
            status: 'PENDING',
            description: 'Trial period ended - First subscription charge',
            metadata: {
              stripeInvoiceId: updatedStripeSub.latest_invoice as string,
              trialEnd: true,
            },
          },
        });

        // Send trial expiry email
        if (sub.customerProfile?.email) {
          await sendTrialExpiryEmail({
            to: sub.customerProfile.email,
            customerName: sub.customerProfile.name || 'Valued Customer',
            planAmount: sub.plan.price / 100, // Convert from cents
            currency: sub.plan.currency,
            nextBillingDate: new Date(updatedStripeSub.current_period_end * 1000),
          });
        }

        processedCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          subscriptionId: sub.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Error processing subscription ${sub.id}:`, error);

        // Update subscription status to PAST_DUE if there's an error
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            metadata: {
              ...sub.metadata,
              lastError: error instanceof Error ? error.message : 'Unknown error',
              lastErrorAt: new Date().toISOString(),
            },
          },
        });
      }
    }

    // Create a log entry for this run
    await prisma.cronJobLog.create({
      data: {
        jobName: 'expire-trials',
        startTime: now,
        endTime: new Date(),
        processedCount,
        errorCount,
        errors: JSON.stringify(errors),
      },
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      details: errors,
    });
  } catch (error) {
    console.error('Error in trial expiry job:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}