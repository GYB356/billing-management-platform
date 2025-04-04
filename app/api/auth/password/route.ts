import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import {
  validatePassword,
  updatePassword,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  clearPasswordResetToken,
} from '@/lib/auth/password';
import { withRateLimit } from '@/lib/auth/rate-limit';
import { getToken } from 'next-auth/jwt';
import { sendPasswordResetEmail } from '@/lib/email';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const confirmResetSchema = z.object({
  token: z.string(),
  newPassword: z.string(),
});

// POST /api/auth/password/change - Change password
export const POST = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const data = await req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(data);

    // Validate new password
    await validatePassword(token.sub, newPassword);

    // Update password
    await updatePassword(token.sub, newPassword);

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'POST',
    schema: changePasswordSchema,
  }
);

// POST /api/auth/password/reset - Request password reset
export const PUT = createHandler(
  async (req) => {
    const data = await req.json();
    const { email } = resetPasswordSchema.parse(data);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return new NextResponse(null, { status: 204 });
    }

    // Generate reset token
    const resetToken = await generatePasswordResetToken(user.id);

    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken);

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'PUT',
    schema: resetPasswordSchema,
  }
);

// POST /api/auth/password/reset/confirm - Confirm password reset
export const PATCH = createHandler(
  async (req) => {
    const data = await req.json();
    const { token, newPassword } = confirmResetSchema.parse(data);

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Verify token
    const isValid = await verifyPasswordResetToken(user.id, token);
    if (!isValid) {
      throw new Error('Invalid reset token');
    }

    // Validate and update password
    await validatePassword(user.id, newPassword);
    await updatePassword(user.id, newPassword);

    // Clear reset token
    await clearPasswordResetToken(user.id);

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'PATCH',
    schema: confirmResetSchema,
  }
); 