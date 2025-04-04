import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { parse } from 'json2csv';

const exportSchema = z.object({
  type: z.enum(['financial', 'customer']),
  format: z.enum(['csv', 'json']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = exportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { type, format } = validationResult.data;
    let data;

    if (type === 'financial') {
      data = await prisma.subscription.findMany({
        select: {
          id: true,
          status: true,
          plan: { select: { name: true } },
          user: { select: { email: true } },
          createdAt: true,
        },
      });
    } else if (type === 'customer') {
      data = await prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });
    }

    if (format === 'csv') {
      const csv = parse(data);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-data.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}