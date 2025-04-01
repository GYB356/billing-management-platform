import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/security';
import bcrypt from 'bcryptjs';

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxHistory: 5, // Number of previous passwords to check
};

// Password validation schema
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Password must be at least ${PASSWORD_POLICY.minLength} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Password history model
interface PasswordHistory {
  password: string;
  createdAt: Date;
}

export async function validatePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  // Validate password against policy
  passwordSchema.parse(newPassword);

  // Get user's password history
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHistory: true,
      password: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  // Check if password is in history
  const passwordHistory = user.passwordHistory || [];
  const currentPassword = user.password;

  // Check current password
  if (currentPassword && await bcrypt.compare(newPassword, currentPassword)) {
    throw new ApiError(400, 'New password cannot be the same as current password', 'SAME_PASSWORD');
  }

  // Check password history
  for (const history of passwordHistory) {
    if (await bcrypt.compare(newPassword, history.password)) {
      throw new ApiError(
        400,
        `Password was used in the last ${PASSWORD_POLICY.maxHistory} passwords`,
        'PASSWORD_IN_HISTORY'
      );
    }
  }
}

export async function updatePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  // Validate password
  await validatePassword(userId, newPassword);

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Get current password history
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      passwordHistory: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  // Update password history
  const passwordHistory = user.passwordHistory || [];
  const newHistory = [
    { password: hashedPassword, createdAt: new Date() },
    ...passwordHistory,
  ].slice(0, PASSWORD_POLICY.maxHistory);

  // Update user's password and history
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordHistory: newHistory,
    },
  });
}

export async function verifyPassword(
  userId: string,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user?.password) {
    return false;
  }

  return bcrypt.compare(password, user.password);
}

export async function generatePasswordResetToken(
  userId: string
): Promise<string> {
  const token = Math.random().toString(36).substring(2, 15);
  const hashedToken = await bcrypt.hash(token, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
    },
  });

  return token;
}

export async function verifyPasswordResetToken(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      resetPasswordToken: true,
      resetPasswordExpires: true,
    },
  });

  if (!user?.resetPasswordToken || !user?.resetPasswordExpires) {
    return false;
  }

  if (user.resetPasswordExpires < new Date()) {
    return false;
  }

  return bcrypt.compare(token, user.resetPasswordToken);
}

export async function clearPasswordResetToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });
} 