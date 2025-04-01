import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { generateDailyReport, generateWeeklyReport, sendSecurityReport } from '@/lib/security/reports';
import { prisma } from '@/lib/prisma';

// GET /api/admin/security/reports/daily - Get daily security report
export const GET = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const report = await generateDailyReport();
    return NextResponse.json(report);
  },
  {
    method: 'GET',
  }
);

// POST /api/admin/security/reports/weekly - Get weekly security report
export const POST = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const report = await generateWeeklyReport();
    return NextResponse.json(report);
  },
  {
    method: 'POST',
  }
);

// PUT /api/admin/security/reports/send - Send security reports to admins
export const PUT = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const { type } = await req.json();
    if (!['daily', 'weekly'].includes(type)) {
      throw new Error('Invalid report type');
    }

    const report = type === 'daily' ? await generateDailyReport() : await generateWeeklyReport();
    
    // Get admin emails
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });

    const recipients = admins.map(admin => admin.email);
    await sendSecurityReport(report, recipients);

    return NextResponse.json({ success: true });
  },
  {
    method: 'PUT',
  }
); 