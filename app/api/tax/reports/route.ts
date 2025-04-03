import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = new Date(searchParams.get('from') || '');
    const to = new Date(searchParams.get('to') || '');

    // Fetch invoices within the date range
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
        status: 'PAID',
      },
      include: {
        taxRates: true,
      },
    });

    // Group invoices by month for the report
    const monthlyData = invoices.reduce((acc, invoice) => {
      const month = invoice.createdAt.toISOString().slice(0, 7); // YYYY-MM format
      
      if (!acc[month]) {
        acc[month] = {
          period: month,
          totalRevenue: 0,
          totalTax: 0,
          taxByRate: {},
        };
      }

      acc[month].totalRevenue += invoice.subtotal;
      acc[month].totalTax += invoice.taxAmount;

      // Track tax by rate
      invoice.taxRates.forEach((taxRate) => {
        if (!acc[month].taxByRate[taxRate.name]) {
          acc[month].taxByRate[taxRate.name] = 0;
        }
        acc[month].taxByRate[taxRate.name] += (invoice.subtotal * taxRate.rate) / 100;
      });

      return acc;
    }, {} as Record<string, any>);

    // Convert to array and sort by period
    const reportData = Object.values(monthlyData).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Failed to generate tax report:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    );
  }
} 