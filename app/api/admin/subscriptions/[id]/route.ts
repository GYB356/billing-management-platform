import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.JWT_SECRET });

  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { status } = await req.json();

  const updatedSubscription = await prisma.subscription.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json(updatedSubscription);
}