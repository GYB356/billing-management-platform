import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PatchService } from '@/app/billing/features/carbon-tracking/patch-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const estimateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  category: z.string(),
});

const offsetSchema = z.object({
  estimateId: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type } = body;

    const org = await prisma.organization.findFirst({
      where: { userId: session.user.id }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const patchService = new PatchService(org.id);

    switch (type) {
      case 'estimate': {
        const data = estimateSchema.parse(body);
        const estimate = await patchService.estimateTransactionEmissions(data);
        return NextResponse.json(estimate);
      }

      case 'offset': {
        const data = offsetSchema.parse(body);
        const offset = await patchService.purchaseOffsets(data.estimateId);
        return NextResponse.json(offset);
      }

      case 'metrics': {
        const metrics = await patchService.getMetrics();
        return NextResponse.json(metrics);
      }

      default:
        return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Carbon tracking API error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 