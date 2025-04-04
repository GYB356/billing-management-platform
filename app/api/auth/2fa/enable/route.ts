import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateTOTPSecret, generateQRCode } from '@/lib/totp';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate TOTP secret
    const { secret, otpauthUrl } = generateTOTPSecret(session.user.email);

    // Save the secret to the user's account
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpSecret: secret },
    });

    // Generate QR code for the user to scan
    const qrCode = await generateQRCode(otpauthUrl);

    return NextResponse.json({ success: true, qrCode });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to enable 2FA' },
      { status: 500 }
    );
  }
}