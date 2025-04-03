import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page')) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const planId = searchParams.get('plan');

    const where = {
      ...(status && { status }),
      ...(planId && { planId }),
    };

    const [subscriptions, totalCount] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          customer: {
            select: {
              name: true,
              email: true,
            },
          },
          plan: {
            select: {
              name: true,
              price: true,
            },
          },
        },
        orderBy: {
          currentPeriodStart: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      subscriptions,
      totalCount,
      currentPage: page,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
} 