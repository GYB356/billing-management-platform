import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
=======
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
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
<<<<<<< HEAD
=======

>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

<<<<<<< HEAD
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
=======
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validationResult = querySchema.safeParse(searchParams);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const {
      organizationId,
      startDate,
      endDate,
      status,
      currency,
      minAmount,
      maxAmount,
      search,
      page = '1',
      limit = '10',
    } = validationResult.data;

    // Verify that the user has access to this organization
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });

    if (userOrganizations.length === 0 && session.user.role !== 'ADMIN') {
      return new NextResponse('Access denied', { status: 403 });
    }

    // Build the query
    const where = {
      organizationId,
      ...(startDate && {
        createdAt: {
          gte: new Date(startDate),
        },
      }),
      ...(endDate && {
        createdAt: {
          lte: new Date(endDate),
        },
      }),
      ...(status && { status }),
      ...(currency && { currency }),
      ...(minAmount && {
        totalAmount: {
          gte: parseFloat(minAmount),
        },
      }),
      ...(maxAmount && {
        totalAmount: {
          lte: parseFloat(maxAmount),
        },
      }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { 'customer.name': { contains: search, mode: 'insensitive' } },
          { 'organization.name': { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Get total count for pagination
    const total = await prisma.invoice.count({ where });

    // Get paginated results
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        organization: true,
        customer: true,
        subscription: true,
        items: true,
        payments: true,
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
      orderBy: {
        createdAt: 'desc',
      },
<<<<<<< HEAD
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
=======
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    // Calculate summary statistics
    const summary = await prisma.invoice.aggregate({
      where,
      _sum: {
        totalAmount: true,
        taxAmount: true,
        paidAmount: true,
      },
      _count: {
        _all: true,
        status: true,
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });

    // Log successful query
    await createEvent({
      eventType: 'INVOICE_HISTORY_QUERIED',
      resourceType: 'INVOICE',
<<<<<<< HEAD
      organizationId: session.user.organizationId,
=======
      organizationId,
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      severity: EventSeverity.INFO,
      metadata: {
        filters: {
          startDate,
          endDate,
          status,
<<<<<<< HEAD
          customerId,
        },
        total,
        page,
        limit,
=======
          currency,
          minAmount,
          maxAmount,
          search,
        },
        total,
        page: parseInt(page),
        limit: parseInt(limit),
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      },
    });

    return NextResponse.json({
      invoices,
      pagination: {
        total,
<<<<<<< HEAD
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
=======
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        totalAmount: summary._sum.totalAmount || 0,
        totalTax: summary._sum.taxAmount || 0,
        totalPaid: summary._sum.paidAmount || 0,
        totalInvoices: summary._count._all,
        statusCounts: summary._count.status,
      },
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
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