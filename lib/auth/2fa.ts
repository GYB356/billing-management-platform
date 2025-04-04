import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/security';

export interface TwoFactorSecret {
  secret: string;
  qrCode: string;
}

export function generate2FASecret(userId: string) {
  const secret = speakeasy.generateSecret({ name: `BillingPlatform (${userId})` });
  return secret;
}

export async function generateQRCode(secret: string) {
  return QRCode.toDataURL(secret.otpauth_url!);
}

export async function generateTwoFactorSecret(userId: string): Promise<TwoFactorSecret> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const secret = generate2FASecret(user.email);

  const qrCode = await generateQRCode(secret.otpauth_url);

  // Store the secret temporarily (will be confirmed when user verifies)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorTempSecret: secret.base32,
      twoFactorEnabled: false,
    },
  });

  return {
    secret: secret.base32,
    qrCode,
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

  const isValid = verify2FAToken(user.twoFactorTempSecret, token);

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

export function verify2FAToken(secret: string, token: string) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
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