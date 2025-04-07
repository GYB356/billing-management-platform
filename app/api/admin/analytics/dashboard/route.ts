import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculateMRR, calculateARR } from '@/lib/metrics';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date and start of month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    // Calculate MRR and ARR
    const mrr = calculateMRR(activeSubscriptions);
    const arr = calculateARR(mrr);

    // Calculate churn rate
    const [currentMonthChurn, prevMonthChurn] = await Promise.all([
      prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: {
            gte: startOfMonth,
            lt: now,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: {
            gte: startOfPrevMonth,
            lt: startOfMonth,
          },
        },
      }),
    ]);

    const totalActiveStart = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: {
          lt: startOfMonth,
        },
      },
    });

    const churnRate = totalActiveStart > 0 
      ? (currentMonthChurn / totalActiveStart) * 100 
      : 0;

    // Get revenue data for the last 12 months
    const revenueData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as date,
        SUM("totalAmount") as revenue
      FROM "invoices"
      WHERE "status" = 'PAID'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY date ASC
    `;

    return NextResponse.json({
      metrics: {
        mrr,
        arr,
        activeSubscriptions: activeSubscriptions.length,
        churnRate,
      },
      revenueData,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
