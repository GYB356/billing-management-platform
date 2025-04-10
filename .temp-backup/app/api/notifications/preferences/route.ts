import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const preferences = await prisma.notificationPreferences.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ preferences });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { type, ...settings } = body;

  const preference = await prisma.notificationPreferences.upsert({
    where: {
      userId_type: {
        userId: session.user.id,
        type: type,
      },
    },
    update: settings,
    create: {
      userId: session.user.id,
      type,
      ...settings,
    },
  });

  return NextResponse.json({ preference });
}