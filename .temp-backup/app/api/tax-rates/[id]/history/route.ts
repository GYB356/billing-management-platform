import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxRate = await prisma.taxRate.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!taxRate) {
      return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 });
    }

    const history = await prisma.taxRateHistory.findMany({
      where: {
        taxRateId: params.id,
      },
      orderBy: {
        changedAt: 'desc',
      },
      include: {
        changedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching tax rate history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax rate history' },
      { status: 500 }
    );
  }
} 