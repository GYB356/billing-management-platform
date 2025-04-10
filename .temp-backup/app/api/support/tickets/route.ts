import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const { userId, subject, message } = await request.json();

  const ticket = await prisma.supportTicket.create({
    data: { userId, subject, message },
  });

  return NextResponse.json(ticket);
}
