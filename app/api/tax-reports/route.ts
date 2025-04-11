import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startDate, endDate, taxRateIds } = await req.json();

    // Fetch tax rates
    const taxRates = await prisma.taxRate.findMany({
      where: {
        id: {
          in: taxRateIds,
        },
        organizationId: session.user.organizationId,
      },
    });

    // Fetch invoices with taxes for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        taxes: {
          where: {
            taxRateId: {
              in: taxRateIds,
            },
          },
          include: {
            taxRate: true,
          },
        },
      },
    });

    // Calculate tax totals by rate
    const taxTotals = taxRates.map((taxRate) => {
      const rateInvoices = invoices.filter((invoice) =>
        invoice.taxes.some((tax) => tax.taxRateId === taxRate.id)
      );

      const totalAmount = rateInvoices.reduce((sum, invoice) => {
        const tax = invoice.taxes.find((t) => t.taxRateId === taxRate.id);
        return sum + (tax?.amount || 0);
      }, 0);

      return {
        taxRate: {
          id: taxRate.id,
          name: taxRate.name,
          rate: taxRate.rate,
        },
        totalAmount,
        invoiceCount: rateInvoices.length,
      };
    });

    // Calculate overall totals
    const totalTaxAmount = taxTotals.reduce((sum, total) => sum + total.totalAmount, 0);
    const totalInvoices = invoices.length;

    return NextResponse.json({
      period: {
        startDate,
        endDate,
      },
      taxTotals,
      summary: {
        totalTaxAmount,
        totalInvoices,
      },
    });
  } catch (error) {
    console.error('Error generating tax report:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    );
  }
} 