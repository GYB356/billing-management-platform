import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createEvent, EventSeverity } from '@/lib/events';
import { z } from 'zod';

// Validation schema for query parameters
const querySchema = z.object({
  organizationId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['SUCCEEDED', 'FAILED', 'PENDING', 'REFUNDED']).optional(),
  paymentMethod: z.string().optional(),
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
      paymentMethod,
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
      ...(paymentMethod && { paymentMethod }),
      ...(currency && { currency }),
      ...(minAmount && {
        amount: {
          gte: parseFloat(minAmount),
        },
      }),
      ...(maxAmount && {
        amount: {
          lte: parseFloat(maxAmount),
        },
      }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { 'invoice.number': { contains: search, mode: 'insensitive' } },
          { 'organization.name': { contains: search, mode: 'insensitive' } },
          { 'customer.name': { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Get total count for pagination
    const total = await prisma.transaction.count({ where });

    // Get paginated results
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        organization: true,
        invoice: true,
        customer: true,
        refund: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    // Calculate summary statistics
    const summary = await prisma.transaction.aggregate({
      where: {
        ...where,
        status: 'SUCCEEDED',
      },
      _sum: {
        amount: true,
        refundAmount: true,
      },
      _count: {
        _all: true,
        status: true,
        paymentMethod: true,
      },
    });

    // Calculate success rate
    const successRate = total > 0
      ? (summary._count.status?.SUCCEEDED || 0) / total * 100
      : 0;

    // Log successful query
    await createEvent({
      eventType: 'PAYMENT_HISTORY_QUERIED',
      resourceType: 'PAYMENT',
      organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        filters: {
          startDate,
          endDate,
          status,
          paymentMethod,
          currency,
          minAmount,
          maxAmount,
          search,
        },
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        successRate,
      },
    });

    return NextResponse.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        totalAmount: summary._sum.amount || 0,
        totalRefunded: summary._sum.refundAmount || 0,
        totalTransactions: summary._count._all,
        statusCounts: summary._count.status,
        paymentMethodCounts: summary._count.paymentMethod,
        successRate,
      },
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);

    // Log error event
    await createEvent({
      eventType: 'PAYMENT_HISTORY_ERROR',
      resourceType: 'PAYMENT',
      severity: EventSeverity.ERROR,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 