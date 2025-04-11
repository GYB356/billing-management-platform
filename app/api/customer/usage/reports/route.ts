import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUsageReport, getUsageReports, generateMonthlyReport } from '@/lib/usage/report';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const reportId = searchParams.get('id');

    const customer = await prisma.customer.findFirst({
      where: {
        userId: session.user.id,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (reportId) {
      const report = await prisma.usageReport.findUnique({
        where: { id: reportId },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!report || report.customerId !== customer.id) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      return NextResponse.json(report);
    }

    const reports = await getUsageReports(customer.id, limit);
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Usage reports fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        userId: session.user.id,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const data = await request.json();
    const { subscriptionId, periodStart, periodEnd, type } = data;

    if (type === 'monthly') {
      const reports = await generateMonthlyReport(customer.id);
      return NextResponse.json(reports);
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Period start and end dates are required' },
        { status: 400 }
      );
    }

    const report = await generateUsageReport({
      customerId: customer.id,
      subscriptionId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Usage report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate usage report' },
      { status: 500 }
    );
  }
}
