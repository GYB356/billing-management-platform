import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { organizationId, certificateUrl } = await req.json();

  // Update organization with certificate URL
  await prisma.organization.update({
    where: { id: organizationId },
    data: { taxExemptionCertificate: certificateUrl },
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const { organizationId } = req.nextUrl.searchParams;

  // Fetch certificate
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { taxExemptionCertificate: true },
  });

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({ certificate: organization.taxExemptionCertificate });
}