import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the last 12 months of revenue data
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        start: d,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0),
        month: d.toLocaleString('default', { month: 'short', year: '2-digit' })
      };
    }).reverse();

    const revenueData = await Promise.all(
      months.map(async ({ start, end, month }) => {
        const revenue = await prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          _sum: {
            amount: true,
          },
        });

        return {
          month,
          revenue: (revenue._sum.amount || 0) / 100, // Convert cents to dollars
        };
      })
    );

    return NextResponse.json(revenueData);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
} 