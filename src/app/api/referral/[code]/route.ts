import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: params.code },
      select: {
        name: true,
        email: true,
      },
    });

    if (!referrer) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    return NextResponse.json({ referrer });
  } catch (error) {
    console.error('Error fetching referrer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrer information' },
      { status: 500 }
    );
  }
} 