import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyTwoFactorCode, generateBackupCodes } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return new NextResponse('Verification code is required', { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      return new NextResponse('2FA setup not initiated', { status: 400 });
    }

    const isValid = verifyTwoFactorCode(user.twoFactorSecret, code);

    if (!isValid) {
      return new NextResponse('Invalid verification code', { status: 400 });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Update user with backup codes
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        backupCodes,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json({ backupCodes });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 