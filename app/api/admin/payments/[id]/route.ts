import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.JWT_SECRET });

  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { amount } = await req.json();

  // Logic to process refund (e.g., via Stripe)
  const payment = await prisma.payment.update({
    where: { id: params.id },
    data: { status: 'REFUNDED' },
  });

  return NextResponse.json(payment);
}