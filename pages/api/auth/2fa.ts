import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import {
  generateTOTPSecret,
  verifyTOTP,
  enable2FA,
  disable2FA,
  verifyBackupCode,
  generateEmailToken,
  verifyEmailToken,
  is2FARequired
} from '../../../lib/auth/2fa';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  switch (req.method) {
    case 'GET':
      // Check 2FA status or generate new TOTP secret
      if (req.query.action === 'status') {
        const required = await is2FARequired(userId);
        return res.json({ required });
      } else if (req.query.action === 'generate') {
        const { secret, qrCodeUrl } = await generateTOTPSecret(userId);
        return res.json({ secret, qrCodeUrl });
      } else if (req.query.action === 'email') {
        const token = await generateEmailToken(userId);
        return res.json({ success: true });
      }
      break;

    case 'POST':
      // Enable/disable 2FA or verify tokens
      if (req.body.action === 'enable') {
        const { secret, token } = req.body;
        const success = await enable2FA(userId, secret, token);
        if (success) {
          return res.json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid token' });
      } else if (req.body.action === 'disable') {
        await disable2FA(userId);
        return res.json({ success: true });
      } else if (req.body.action === 'verify') {
        const { token, method } = req.body;
        let isValid = false;

        if (method === 'totp') {
          isValid = await verifyTOTP(userId, token);
        } else if (method === 'email') {
          isValid = await verifyEmailToken(userId, token);
        } else if (method === 'backup') {
          isValid = await verifyBackupCode(userId, token);
        }

        if (isValid) {
          return res.json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid token' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  return res.status(400).json({ error: 'Invalid action' });
} 