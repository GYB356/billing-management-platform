import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { parse } from 'json2csv';
import PDFDocument from 'pdfkit';
import { calculateMRR, calculateARR } from '@/lib/metrics';

const exportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']),
  dateRange: z.enum(['7d', '30d', '90d', '1y']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const dateRange = searchParams.get('dateRange') || '30d';

    const validationResult = exportSchema.safeParse({ format, dateRange });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    // Calculate date range
    const now = new Date();
    const rangeMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    const startDate = new Date(now.getTime() - rangeMap[dateRange] * 24 * 60 * 60 * 1000);

    // Fetch analytics data
    const [subscriptions, customers, invoices] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        include: {
          plan: true,
          customer: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        include: {
          subscriptions: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: startDate },
          status: 'PAID',
        },
      }),
    ]);

    // Calculate metrics
    const mrr = calculateMRR(subscriptions);
    const arr = calculateARR(mrr);
    const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE').length;
    const churnedSubscriptions = subscriptions.filter(s => s.status === 'CANCELLED').length;
    const churnRate = activeSubscriptions > 0 ? (churnedSubscriptions / activeSubscriptions) * 100 : 0;

    const analyticsData = {
      overview: {
        mrr,
        arr,
        activeSubscriptions,
        churnRate,
        totalCustomers: customers.length,
        totalRevenue: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      },
      subscriptions: {
        active: activeSubscriptions,
        churned: churnedSubscriptions,
        byPlan: subscriptions.reduce((acc, sub) => {
          const planName = sub.plan.name;
          acc[planName] = (acc[planName] || 0) + 1;
          return acc;
        }, {}),
      },
      customers: {
        total: customers.length,
        withActiveSubscription: customers.filter(c => 
          c.subscriptions.some(s => s.status === 'ACTIVE')
        ).length,
      },
      revenue: {
        byMonth: invoices.reduce((acc, inv) => {
          const month = inv.createdAt.toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + inv.totalAmount;
          return acc;
        }, {}),
      },
    };

    // Format response based on requested format
    if (format === 'csv') {
      const flatData = [
        {
          ...analyticsData.overview,
          period: `Last ${dateRange}`,
          exportDate: new Date().toISOString(),
        },
      ];
      const csv = parse(flatData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${dateRange}.csv"`,
        },
      });
    }

    if (format === 'pdf') {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {});

      // Add content to PDF
      doc.fontSize(16).text('Analytics Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: Last ${dateRange}`);
      doc.moveDown();

      // Overview section
      doc.fontSize(14).text('Overview', { underline: true });
      doc.fontSize(12);
      Object.entries(analyticsData.overview).forEach(([key, value]) => {
        doc.text(`${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
      });
      doc.moveDown();

      // Subscription section
      doc.fontSize(14).text('Subscriptions', { underline: true });
      doc.fontSize(12);
      Object.entries(analyticsData.subscriptions.byPlan).forEach(([plan, count]) => {
        doc.text(`${plan}: ${count}`);
      });

      doc.end();

      return new NextResponse(Buffer.concat(chunks), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="analytics-${dateRange}.pdf"`,
        },
      });
    }

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics data' },
      { status: 500 }
    );
  }
}