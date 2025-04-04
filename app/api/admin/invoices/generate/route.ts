import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { z } from 'zod';

const invoiceSchema = z.object({
  subscriptionId: z.string(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = invoiceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { subscriptionId, amount, description } = validationResult.data;

    // Fetch subscription details
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Generate invoice PDF
    const pdfBuffer = await generateInvoicePDF({
      user: subscription.user,
      plan: subscription.plan,
      amount,
      description,
    });

    // Store invoice in the database
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId,
        amount,
        description,
        pdf: pdfBuffer.toString('base64'), // Store PDF as base64
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}