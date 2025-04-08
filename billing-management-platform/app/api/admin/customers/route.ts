import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const customers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        subscriptions: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            plan: {
              select: {
                name: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data to match the expected format
    const formattedCustomers = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      status: customer.status,
      plan: customer.subscriptions[0]?.plan.name || 'No active plan',
    }));

    return NextResponse.json(formattedCustomers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
} 