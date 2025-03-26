import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current month's start date
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all required statistics
    const [
      totalRevenue,
      activeSubscriptions,
      totalUsers,
      newUsersThisMonth,
    ] = await Promise.all([
      // Calculate total revenue from subscriptions
      prisma.subscription.aggregate({
        where: {
          status: 'active',
        },
        _sum: {
          // You'll need to add a price field to your Subscription model
          price: true,
        },
      }),
      // Count active subscriptions
      prisma.subscription.count({
        where: {
          status: 'active',
        },
      }),
      // Count total users
      prisma.user.count(),
      // Count new users this month
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalRevenue: totalRevenue._sum.price || 0,
      activeSubscriptions,
      totalUsers,
      newUsersThisMonth,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
} 