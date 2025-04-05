import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfMonth, subMonths, format } from 'date-fns';

export async function GET() {
  try {
    // Get last 12 months of data
    const endDate = new Date();
    const startDate = subMonths(endDate, 12);

    // Fetch historical revenue data
    const revenueData = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'succeeded',
      },
      _sum: {
        amount: true,
      },
    });

    // Fetch customer segments
    const customerSegments = await prisma.customer.groupBy({
      by: ['type'],
      _count: true,
    });

    // Fetch subscription trends
    const subscriptionTrends = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(endDate, i);
        const monthStart = startOfMonth(date);
        const monthEnd = startOfMonth(subMonths(date, -1));

        return prisma.$transaction([
          prisma.subscription.count({
            where: {
              createdAt: { lte: monthEnd },
              OR: [
                { endDate: { gte: monthEnd } },
                { endDate: null },
              ],
              status: 'ACTIVE',
            },
          }),
          prisma.subscription.count({
            where: {
              status: 'CANCELED',
              updatedAt: {
                gte: monthStart,
                lt: monthEnd,
              },
            },
          }),
        ]);
      })
    );

    // Transform data for frontend
    const historicalData = {
      revenue: revenueData.map(record => ({
        date: record.createdAt.toISOString(),
        value: record._sum.amount || 0,
      })),
      customerSegments: customerSegments.map(segment => ({
        name: segment.type || 'Unknown',
        value: segment._count,
      })),
      subscriptionTrends: subscriptionTrends.map(([ active, churned ], index) => ({
        date: subMonths(endDate, 11 - index).toISOString(),
        active,
        churned,
      })),
    };

    return NextResponse.json(historicalData);
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical metrics' },
      { status: 500 }
    );
  }
}