import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get total users
    const totalUsers = await prisma.user.count();

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'active',
      },
    });

    // Get total revenue from Stripe
    const balance = await stripe.balance.retrieve();
    const totalRevenue = balance.available[0].amount / 100; // Convert from cents to dollars

    // Calculate monthly growth
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const newSubscriptionsThisMonth = await prisma.subscription.count({
      where: {
        currentPeriodStart: {
          gte: lastMonth,
        },
      },
    });

    const monthlyGrowth = activeSubscriptions > 0
      ? (newSubscriptionsThisMonth / activeSubscriptions) * 100
      : 0;

    return NextResponse.json({
      stats: {
        totalRevenue,
        activeSubscriptions,
        totalUsers,
        monthlyGrowth: Math.round(monthlyGrowth),
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Error fetching admin statistics' },
      { status: 500 }
    );
  }
} 