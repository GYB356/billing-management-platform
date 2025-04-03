import { authenticator } from 'otplib';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/security';

export interface TwoFactorSecret {
  secret: string;
  qrCode: string;
}

export async function generateTwoFactorSecret(userId: string): Promise<TwoFactorSecret> {
  const secret = authenticator.generateSecret();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const otpauthUrl = authenticator.keyuri(
    user.email,
    'BillingPlatform',
    secret
  );

  // Store the secret temporarily (will be confirmed when user verifies)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorTempSecret: secret,
      twoFactorEnabled: false,
    },
  });

  return {
    secret,
    qrCode: otpauthUrl,
  };
}

export async function verifyAndEnable2FA(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorTempSecret: true },
  });

  if (!user?.twoFactorTempSecret) {
    throw new ApiError(400, '2FA setup not initiated', 'INVALID_2FA_SETUP');
  }

  const isValid = authenticator.verify({
    token,
    secret: user.twoFactorTempSecret,
  });

  if (!isValid) {
    throw new ApiError(400, 'Invalid 2FA token', 'INVALID_2FA_TOKEN');
  }

  // Enable 2FA and store the confirmed secret
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: user.twoFactorTempSecret,
      twoFactorTempSecret: null,
      twoFactorEnabled: true,
    },
  });

  return true;
}

export async function verify2FAToken(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true },
  });

  if (!user?.twoFactorSecret) {
    throw new ApiError(400, '2FA not enabled', '2FA_NOT_ENABLED');
  }

  return authenticator.verify({
    token,
    secret: user.twoFactorSecret,
  });
}

export async function generateBackupCodes(userId: string): Promise<string[]> {
  const backupCodes = Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 15)
  );

  // Hash the backup codes before storing
  const hashedCodes = await Promise.all(
    backupCodes.map(async (code) => {
      const hashedCode = await bcrypt.hash(code, 10);
      return hashedCode;
    })
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorBackupCodes: hashedCodes,
    },
  });

  return backupCodes;
}

export async function verifyBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorBackupCodes: true },
  });

  if (!user?.twoFactorBackupCodes?.length) {
    return false;
  }

  // Check each backup code
  for (const hashedCode of user.twoFactorBackupCodes) {
    if (await bcrypt.compare(code, hashedCode)) {
      // Remove the used backup code
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorBackupCodes: {
            set: user.twoFactorBackupCodes.filter((c) => c !== hashedCode),
          },
        },
      });
      return true;
    }
  }

  return false;
}

export async function disable2FA(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorTempSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: [],
    },
  });
} 