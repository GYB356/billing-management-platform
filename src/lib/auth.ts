import speakeasy from 'speakeasy';
import prisma from '@/lib/prisma';
import { generate2FAToken, verify2FAToken } from './twoFactorAuth'; // Import 2FA utilities

export async function generateTwoFactorSecret(userId: string) {
  const secret = speakeasy.generateSecret({ length: 20 });
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret.base32 },
  });
  return { otpauthUrl: secret.otpauth_url, base32: secret.base32 };
}

export async function verifyAndEnable2FA(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) return false;

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
  });

  if (verified) {
    await prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });
  }

  return verified;
}

export async function verify2FAToken(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) return false;

  return speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
  });
}

export async function disable2FA(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { isTwoFactorEnabled: false, twoFactorSecret: null },
  });
}

export const authOptions = {
  callbacks: {
    async signIn(user, account, profile) {
      if (user.requires2FA) {
        const is2FAVerified = await verify2FAToken(user.id, account.token);
        if (!is2FAVerified) {
          throw new Error('Two-factor authentication failed.');
        }
      }
      return true;
    },
  },
};
