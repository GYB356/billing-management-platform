import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find the referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code },
      include: {
        referrals: true,
      },
    });

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // Check if code has expired
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Referral code has expired' },
        { status: 400 }
      );
    }

    // Check if code has reached max uses
    if (
      referralCode.maxUses &&
      referralCode.usedCount >= referralCode.maxUses
    ) {
      return NextResponse.json(
        { error: 'Referral code has reached maximum uses' },
        { status: 400 }
      );
    }

    // Check if user has already used this code
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referralCodeId: referralCode.id,
        referredUserId: session.user.id,
      },
    });

    if (existingReferral) {
      return NextResponse.json(
        { error: 'You have already used this referral code' },
        { status: 400 }
      );
    }

    // Create referral record
    const referral = await prisma.referral.create({
      data: {
        referralCodeId: referralCode.id,
        referredUserId: session.user.id,
      },
    });

    // Update referral code usage count
    await prisma.referralCode.update({
      where: { id: referralCode.id },
      data: {
        usedCount: referralCode.usedCount + 1,
      },
    });

    // Return referral details with discount information
    return NextResponse.json({
      referral,
      discount: {
        amount: referralCode.discountAmount,
        type: referralCode.discountType,
      },
    });
  } catch (error) {
    console.error('Error redeeming referral code:', error);
    return NextResponse.json(
      { error: 'Failed to redeem referral code' },
      { status: 500 }
    );
  }
} 