import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Parser } from 'json2csv';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const currency = searchParams.get('currency');

    if (!organizationId) {
      return new NextResponse('Organization ID is required', { status: 400 });
    }

    // Verify organization access
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: true,
      },
    });

    if (!organization) {
      return new NextResponse('Organization not found', { status: 404 });
    }

    // Check if user has access to the organization
    const hasAccess = organization.members.some(
      (member) => member.userId === session.user.id
    );

    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    // Build where clause
    const where: any = { organizationId };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { items: { some: { description: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (currency) {
      where.currency = currency;
    }

    // Get all invoices matching the filters
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data for CSV
    const csvData = invoices.map((invoice) => ({
      'Invoice Number': invoice.number,
      'Date': invoice.createdAt.toISOString(),
      'Due Date': invoice.dueDate.toISOString(),
      'Status': invoice.status,
      'Subtotal': invoice.subtotal,
      'Tax Rate': `${invoice.taxRate}%`,
      'Tax Amount': invoice.taxAmount,
      'Total Amount': invoice.total,
      'Currency': invoice.currency,
      'Notes': invoice.notes || '',
      'Items': invoice.items
        .map(
          (item) =>
            `${item.description} (${item.quantity} x ${item.unitPrice})`
        )
        .join('; '),
    }));

    // Generate CSV
    const parser = new Parser();
    const csv = parser.parse(csvData);

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="invoices-${new Date().toISOString()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting invoices:', error);
    return new NextResponse('Failed to export invoices', { status: 500 });
  }
} 