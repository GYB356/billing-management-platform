import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const logs = await prisma.retryLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch retry logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retry logs' },
      { status: 500 }
    );
  }
} 