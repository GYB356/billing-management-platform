import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import {
  generateTwoFactorSecret,
  verifyAndEnable2FA,
  verify2FAToken,
  generateBackupCodes,
  disable2FA,
} from '@/lib/auth/2fa';
import { getToken } from 'next-auth/jwt';

const verifyTokenSchema = z.object({
  token: z.string().length(6),
});

const backupCodeSchema = z.object({
  code: z.string(),
});

// GET /api/auth/2fa/setup - Generate 2FA secret and QR code
export const GET = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const secret = await generateTwoFactorSecret(token.sub);
    return NextResponse.json(secret);
  },
  {
    method: 'GET',
  }
);

// POST /api/auth/2fa/verify - Verify and enable 2FA
export const POST = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const data = await req.json();
    const { token: verificationToken } = verifyTokenSchema.parse(data);

    const isValid = await verifyAndEnable2FA(token.sub, verificationToken);
    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    // Generate backup codes
    const backupCodes = await generateBackupCodes(token.sub);

    return NextResponse.json({
      success: true,
      backupCodes,
    });
  },
  {
    method: 'POST',
    schema: verifyTokenSchema,
  }
);

// POST /api/auth/2fa/validate - Validate 2FA token
export const PUT = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const data = await req.json();
    const { token: verificationToken } = verifyTokenSchema.parse(data);

    const isValid = await verify2FAToken(token.sub, verificationToken);
    return NextResponse.json({ isValid });
  },
  {
    method: 'PUT',
    schema: verifyTokenSchema,
  }
);

// POST /api/auth/2fa/backup - Verify backup code
export const PATCH = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const data = await req.json();
    const { code } = backupCodeSchema.parse(data);

    const isValid = await verifyBackupCode(token.sub, code);
    return NextResponse.json({ isValid });
  },
  {
    method: 'PATCH',
    schema: backupCodeSchema,
  }
);

// DELETE /api/auth/2fa - Disable 2FA
export const DELETE = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    await disable2FA(token.sub);
    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'DELETE',
  }
); 