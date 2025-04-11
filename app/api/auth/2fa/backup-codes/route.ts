import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateBackupCodes } from '@/lib/auth';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();

    // Update user with new backup codes
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        backupCodes,
      },
    });

    return NextResponse.json({ backupCodes });
  } catch (error) {
    console.error('Error regenerating backup codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 