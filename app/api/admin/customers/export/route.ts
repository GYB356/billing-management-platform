import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const where = {
      AND: [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { stripeCustomerId: { contains: search, mode: 'insensitive' } },
          ],
        },
        status
          ? {
              subscriptions: {
                some: {
                  status: status,
                },
              },
            }
          : {},
      ],
    };

    const customers = await prisma.customer.findMany({
      where,
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert customers to CSV format
    const headers = [
      'Name',
      'Email',
      'Stripe Customer ID',
      'Status',
      'Plan',
      'Created At',
    ];
    const rows = customers.map((customer) => [
      customer.name,
      customer.email,
      customer.stripeCustomerId,
      customer.subscriptions[0]?.status || 'No subscription',
      customer.subscriptions[0]?.plan.name || 'No plan',
      new Date(customer.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="customers.csv"',
      },
    });
  } catch (error) {
    console.error('Error exporting customers:', error);
    return NextResponse.json(
      { error: 'Failed to export customers' },
      { status: 500 }
    );
  }
} 