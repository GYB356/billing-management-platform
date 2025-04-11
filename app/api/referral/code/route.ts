import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const referralCodes = await prisma.referralCode.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        referrals: {
          include: {
            referredUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(referralCodes);
  } catch (error) {
    console.error('Error fetching referral codes:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { discountAmount, discountType = 'percentage', maxUses = null } = body;

    if (!discountAmount || discountAmount <= 0) {
      return new NextResponse('Invalid discount amount', { status: 400 });
    }

    const code = generateReferralCode();
    const referralCode = await prisma.referralCode.create({
      data: {
        code,
        discountAmount,
        discountType,
        maxUses,
        userId: session.user.id,
      },
    });

    return NextResponse.json(referralCode);
  } catch (error) {
    console.error('Error creating referral code:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 