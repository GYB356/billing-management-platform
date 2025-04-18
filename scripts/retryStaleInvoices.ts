import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

async function retryStaleInvoices() {
  console.log('Starting stale invoice retry process...');
  
  const failed = await prisma.retryAttempt.findMany({
    where: {
      status: 'failed',
      attempts: { lt: 3 },
      // Only retry invoices that are at least 1 hour old
      lastAttemptAt: {
        lt: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
    include: {
      user: true, // Include user data for logging
    },
  });

  console.log(`Found ${failed.length} failed invoices to retry`);

  for (const attempt of failed) {
    try {
      console.log(`Processing invoice ${attempt.invoiceId} for user ${attempt.user.email}`);
      
      const invoice = await stripe.invoices.retrieve(attempt.invoiceId);
      if (invoice.status === 'paid') {
        console.log(`Invoice ${attempt.invoiceId} is already paid, updating status`);
        await prisma.retryAttempt.update({
          where: { invoiceId: attempt.invoiceId },
          data: {
            status: 'succeeded',
            updatedAt: new Date(),
          },
        });
        continue;
      }

      const result = await stripe.invoices.pay(attempt.invoiceId);
      
      await prisma.retryAttempt.update({
        where: { invoiceId: attempt.invoiceId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: result.status,
        },
      });

      // Create a payment record for the retry attempt
      if (result.status === 'paid') {
        await prisma.payment.create({
          data: {
            amount: result.amount_paid / 100,
            currency: result.currency,
            status: 'succeeded',
            stripePaymentId: result.payment_intent as string,
            userId: attempt.userId,
            customerId: result.customer as string,
          },
        });
      }

      console.log(`Retried ${attempt.invoiceId}: ${result.status}`);
    } catch (err) {
      console.error(`Retry failed for ${attempt.invoiceId}:`, err);
      
      // Update the retry attempt even if it failed
      await prisma.retryAttempt.update({
        where: { invoiceId: attempt.invoiceId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: 'failed',
        },
      });
    }
  }

  console.log('Completed stale invoice retry process');
}

// Execute and handle errors
retryStaleInvoices()
  .catch((error) => {
    console.error('Error in retry process:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  }); 