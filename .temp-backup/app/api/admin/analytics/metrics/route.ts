import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate financial metrics
    const [mrr, arr, churnRate] = await Promise.all([
      prisma.subscription.aggregate({
        _sum: { quantity: true },
        where: { status: 'active' },
      }),
      prisma.subscription.aggregate({
        _sum: { quantity: true },
        where: { status: 'active' },
      }),
      prisma.subscription.count({
        where: { status: 'canceled' },
      }),
    ]);

    const totalSubscriptions = await prisma.subscription.count();
    const churnRatePercentage = totalSubscriptions
      ? (churnRate / totalSubscriptions) * 100
      : 0;

    return NextResponse.json({
      mrr: mrr._sum.quantity || 0,
      arr: arr._sum.quantity || 0,
      churnRate: churnRatePercentage,
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial metrics' },
      { status: 500 }
    );
  }
}