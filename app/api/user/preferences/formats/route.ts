import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const preferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
    select: {
      dateFormat: true,
      numberFormat: true,
      currencyFormat: true,
    },
  });

  return NextResponse.json(preferences || {
    dateFormat: 'long',
    numberFormat: 'standard',
    currencyFormat: 'symbol',
  });
}

export async function PUT(request: Request) {
    
  const session = await getServerSession(authOptions);
  const limited = await rateLimit('user-preferences-formats', session?.user?.id);

  if (!limited.success) {
    return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  }

  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { dateFormat, numberFormat, currencyFormat } = body;

  const preferences = await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {
      dateFormat,
      numberFormat,
      currencyFormat,
    },
    create: {
      userId: session.user.id,
      dateFormat,
      numberFormat,
      currencyFormat,
    },
  });

  return NextResponse.json(preferences);
}