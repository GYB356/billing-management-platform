import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createEvent, EventSeverity } from '@/lib/events';
import { z } from 'zod';

// Validation schema for query parameters
const querySchema = z.object({
  organizationId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE']).optional(),
  currency: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    // Build the where clause based on filters
    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    // Get total count for pagination
    const total = await prisma.invoice.count({ where });

    // Get invoices with pagination
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        items: true,
        payments: true,
        events: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate statistics
    const stats = await prisma.invoice.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: {
        total: true,
      },
    });

    // Log successful query
    await createEvent({
      eventType: 'INVOICE_HISTORY_QUERIED',
      resourceType: 'INVOICE',
      organizationId: session.user.organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        filters: {
          startDate,
          endDate,
          status,
          customerId,
        },
        total,
        page,
        limit,
      },
    });

    return NextResponse.json({
      invoices,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
      stats: stats.reduce((acc, stat) => ({
        ...acc,
        [stat.status]: {
          count: stat._count,
          total: stat._sum.total,
        },
      }), {}),
    });
  } catch (error) {
    console.error('Error fetching invoice history:', error);

    // Log error event
    await createEvent({
      eventType: 'INVOICE_HISTORY_ERROR',
      resourceType: 'INVOICE',
      severity: EventSeverity.ERROR,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 