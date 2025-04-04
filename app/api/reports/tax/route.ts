import { NextResponse } from 'next/server';
import { parse } from 'json2csv';
import prisma from '@/lib/prisma';

export async function GET() {
  const taxes = await prisma.tax.findMany();

  const csv = parse(taxes, { fields: ['region', 'rate', 'totalCollected'] });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="tax-report.csv"',
    },
  });
}
