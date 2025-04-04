import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const taxRates = await prisma.taxRate.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        rate: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(taxRates);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch tax rates' }),
      { status: 500 }
    );
  }
} 