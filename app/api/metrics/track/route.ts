import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const metricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, value, unit, tags } = metricSchema.parse(body);

    const metric = await prisma.customMetric.create({
      data: {
        name,
        value,
        unit,
        tags: tags || {},
      },
    });

    return NextResponse.json(metric);
  } catch (error) {
    console.error('Error tracking metric:', error);
    return NextResponse.json(
      { error: 'Failed to track metric' },
      { status: 500 }
    );
  }
}