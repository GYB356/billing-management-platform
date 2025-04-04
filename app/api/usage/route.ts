import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 });
    }

    const usageRecords = await prisma.usageRecord.findMany({
      where: { subscriptionId: parseInt(subscriptionId, 10) },
      orderBy: { recordedAt: 'desc' },
    });

    return NextResponse.json({ usageRecords });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch usage records' }, { status: 500 });
  }
}