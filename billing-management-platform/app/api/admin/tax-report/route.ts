import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tax history with user details
    const report = await prisma.taxHistory.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Format the report data
    const formattedReport = report.map(entry => ({
      id: entry.id,
      userId: entry.userId,
      userEmail: entry.user.email,
      userName: entry.user.name,
      rate: entry.rate,
      country: entry.country,
      region: entry.region || null,
      date: entry.date,
    }));

    return NextResponse.json(formattedReport);
  } catch (error) {
    console.error('Error generating tax report:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    );
  }
} 