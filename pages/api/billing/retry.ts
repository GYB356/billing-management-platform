import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    // Retrieve the invoice to verify it exists and belongs to the user
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if we've exceeded retry attempts (optional: implement your own retry limit)
    const existingAttempt = await prisma.retryAttempt.findUnique({
      where: { invoiceId },
    });

    if (existingAttempt && existingAttempt.attempts >= 3) {
      return res.status(400).json({ 
        error: 'Maximum retry attempts exceeded',
        attempts: existingAttempt.attempts 
      });
    }

    // Attempt to pay the invoice
    try {
      const retry = await stripe.invoices.pay(invoiceId);
      
      // Record the attempt
      const attempt = await prisma.retryAttempt.upsert({
        where: { invoiceId },
        update: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: retry.status,
        },
        create: {
          invoiceId,
          userId: session.user.id,
          attempts: 1,
          status: retry.status,
        },
      });

      return res.status(200).json({ 
        success: true, 
        attempt,
        invoice: retry 
      });
    } catch (stripeError: any) {
      // Handle Stripe-specific errors
      const attempt = await prisma.retryAttempt.upsert({
        where: { invoiceId },
        update: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: 'failed',
        },
        create: {
          invoiceId,
          userId: session.user.id,
          attempts: 1,
          status: 'failed',
        },
      });

      return res.status(400).json({
        error: stripeError.message || 'Payment retry failed',
        code: stripeError.code,
        attempt
      });
    }
  } catch (error: any) {
    console.error('Error processing retry:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
} 