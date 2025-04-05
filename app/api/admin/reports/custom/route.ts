import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { parse } from 'json2csv';

const reportSchema = z.object({
  filters: z.object({
    dateRange: z.tuple([z.string(), z.string()]).optional(),
    userId: z.string().optional(),
    planId: z.string().optional(),
  }).optional(),
  groupBy: z.enum(['date', 'user', 'plan']).optional(),
  format: z.enum(['csv', 'json']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = reportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { filters, groupBy, format } = validationResult.data;

    // Build query based on filters
    const where: any = {};
    if (filters?.dateRange) {
      where.createdAt = {
        gte: new Date(filters.dateRange[0]),
        lte: new Date(filters.dateRange[1]),
      };
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.planId) {
      where.planId = filters.planId;
    }

    // Fetch data from the database
    const data = await prisma.subscription.findMany({
      where,
      include: {
        user: true,
        plan: true,
      },
    });

    // Group data if needed
    let groupedData = data;
    if (groupBy === 'date') {
      groupedData = data.reduce((acc, item) => {
        const date = item.createdAt.toISOString().split('T')[0];
        acc[date] = acc[date] || [];
        acc[date].push(item);
        return acc;
      }, {});
    } else if (groupBy === 'user') {
      groupedData = data.reduce((acc, item) => {
        acc[item.user.email] = acc[item.user.email] || [];
        acc[item.user.email].push(item);
        return acc;
      }, {});
    } else if (groupBy === 'plan') {
      groupedData = data.reduce((acc, item) => {
        acc[item.plan.name] = acc[item.plan.name] || [];
        acc[item.plan.name].push(item);
        return acc;
      }, {});
    }

    // Return data in the requested format
    if (format === 'csv') {
      const csv = parse(data);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="custom-report.csv"',
        },
      });
    }

    return NextResponse.json(groupedData);
  } catch (error) {
    console.error('Error generating custom report:', error);
    return NextResponse.json(
      { error: 'Failed to generate custom report' },
      { status: 500 }
    );
  }
}