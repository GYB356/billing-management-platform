import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required parameters: name, startTime, endTime' },
        { status: 400 }
      );
    }

    const metrics = await prisma.customMetric.findMany({
      where: {
        name,
        timestamp: {
          gte: new Date(startTime),
          lte: new Date(endTime),
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error querying metrics:', error);
    return NextResponse.json(
      { error: 'Failed to query metrics' },
      { status: 500 }
    );
  }
}