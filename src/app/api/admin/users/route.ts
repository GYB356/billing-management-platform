import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'lastPayment';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build the where clause for filtering
    const where = {
      ...(status !== 'all' && {
        subscription_status: status,
      }),
    };

    // Build the orderBy clause for sorting
    const orderBy = {
      ...(sortBy === 'lastPayment' && {
        subscription: {
          lastPaymentStatus: sortOrder,
        },
      }),
      ...(sortBy === 'subscriptionEnd' && {
        subscription: {
          currentPeriodEnd: sortOrder,
        },
      }),
      ...(sortBy === 'createdAt' && {
        createdAt: sortOrder,
      }),
      ...(sortBy === 'name' && {
        name: sortOrder,
      }),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy,
      include: {
        subscription: {
          select: {
            planName: true,
            currentPeriodEnd: true,
            lastPaymentStatus: true,
          },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 