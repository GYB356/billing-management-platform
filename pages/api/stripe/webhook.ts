import { buffer } from 'micro';
import Stripe from 'stripe';
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const sig = req.headers['stripe-signature']!;
  const buf = await buffer(req);
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).send('Webhook Error');
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        await prisma.payment.create({
          data: {
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            stripePaymentId: paymentIntent.id,
            userId: paymentIntent.metadata.userId,
          },
        });
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        // Get the customer to find the associated user
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer || customer.deleted) {
          throw new Error('Customer not found or deleted');
        }

        const userId = customer.metadata?.userId;
        if (userId) {
          await prisma.retryAttempt.upsert({
            where: { invoiceId: invoice.id },
            update: {
              attempts: { increment: 1 },
              lastAttemptAt: new Date(),
              status: 'failed',
            },
            create: {
              invoiceId: invoice.id,
              userId: userId,
              status: 'failed',
              attempts: 1,
            },
          });

          // Create a failed payment record
          await prisma.payment.create({
            data: {
              amount: invoice.amount_due / 100,
              currency: invoice.currency,
              status: 'failed',
              stripePaymentId: invoice.payment_intent as string,
              userId: userId,
              customerId: customerId,
            },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Update retry attempt status if it exists
        await prisma.retryAttempt.updateMany({
          where: { 
            invoiceId: invoice.id,
            status: { not: 'succeeded' }
          },
          data: {
            status: 'succeeded',
            updatedAt: new Date(),
          },
        });

        // Create a successful payment record if this was a retry
        const retryAttempt = await prisma.retryAttempt.findUnique({
          where: { invoiceId: invoice.id },
          include: { user: true },
        });

        if (retryAttempt) {
          await prisma.payment.create({
            data: {
              amount: invoice.amount_paid / 100,
              currency: invoice.currency,
              status: 'succeeded',
              stripePaymentId: invoice.payment_intent as string,
              userId: retryAttempt.userId,
              customerId: invoice.customer as string,
            },
          });
        }
        break;
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 