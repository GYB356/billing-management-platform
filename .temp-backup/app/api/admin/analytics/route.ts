import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.JWT_SECRET });

  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const revenue = await prisma.payment.aggregate({
    _sum: { amount: true },
  });

  const userCount = await prisma.user.count();
  const subscriptionCount = await prisma.subscription.count();

  return NextResponse.json({
    revenue: revenue._sum.amount || 0,
    userCount,
    subscriptionCount,
  });
}