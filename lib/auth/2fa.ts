import { authenticator } from 'otplib';
import { prisma } from '../db';
import { randomBytes } from 'crypto';
import { sendEmail } from '../email';

interface Generate2FAResponse {
  secret: string;
  qrCodeUrl: string;
}

export async function generateTOTPSecret(userId: string): Promise<Generate2FAResponse> {
  const secret = authenticator.generateSecret();
  const user = await prisma.user.findUnique({ where: { id: userId } });
<<<<<<< HEAD

=======
  
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
  if (!user) {
    throw new Error('User not found');
  }

  const qrCodeUrl = authenticator.keyuri(
    user.email,
    'Your App Name',
    secret
  );

  return {
    secret,
    qrCodeUrl
  };
}

export async function verifyTOTP(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user?.twoFactorSecret) {
    throw new Error('2FA is not set up for this user');
  }

  const isValid = authenticator.verify({
    token,
    secret: user.twoFactorSecret
  });

  if (isValid) {
    await prisma.user.update({
      where: { id: userId },
      data: { last2FAVerified: new Date() }
    });
  }

  return isValid;
}

export async function enable2FA(userId: string, secret: string, token: string): Promise<boolean> {
  // Verify the token first
  const isValid = authenticator.verify({
    token,
    secret
  });

  if (!isValid) {
    return false;
  }

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () => 
    randomBytes(4).toString('hex')
  );

  // Enable 2FA and store backup codes
  await prisma.user.update({
    where: { id: userId },
    data: {
      is2FAEnabled: true,
      twoFactorSecret: secret,
      backupCodes,
      last2FAVerified: new Date()
    }
  });

  return true;
}

export async function disable2FA(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      is2FAEnabled: false,
      twoFactorSecret: null,
      backupCodes: [],
      last2FAVerified: null
    }
  });
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user?.backupCodes.includes(code)) {
    return false;
  }

<<<<<<< HEAD
      // Remove the used backup code
      await prisma.user.update({
        where: { id: userId },
        data: {
=======
  // Remove the used backup code
  await prisma.user.update({
    where: { id: userId },
    data: {
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      backupCodes: user.backupCodes.filter(c => c !== code),
      last2FAVerified: new Date()
    }
  });

<<<<<<< HEAD
      return true;
    }
=======
  return true;
}
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

export async function generateEmailToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error('User not found');
  }

  // Store the token in the session or a temporary store
  // This is just an example - implement secure token storage as needed
  await prisma.verificationToken.create({
    data: {
      identifier: userId,
      token,
      expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
  });

  // Send email with the token
  await sendEmail({
    to: user.email,
    subject: '2FA Verification Code',
    text: `Your verification code is: ${token.substring(0, 6)}`,
    html: `
      <h1>2FA Verification Code</h1>
      <p>Your verification code is: <strong>${token.substring(0, 6)}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `
  });

  return token;
}

export async function verifyEmailToken(userId: string, token: string): Promise<boolean> {
  const storedToken = await prisma.verificationToken.findFirst({
    where: {
      identifier: userId,
      token,
      expires: { gt: new Date() }
    }
  });

  if (!storedToken) {
<<<<<<< HEAD
  return false;
}
=======
    return false;
  }
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

  // Delete the used token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: userId,
        token
      }
    }
  });

  // Update last verification time
  await prisma.user.update({
    where: { id: userId },
    data: { last2FAVerified: new Date() }
  });

  return true;
}

export async function is2FARequired(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.is2FAEnabled) {
    return false;
  }

  // Check if the last verification was within the last 24 hours
  if (user.last2FAVerified) {
    const lastVerified = new Date(user.last2FAVerified);
    const now = new Date();
    const hoursSinceLastVerification = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastVerification >= 24;
  }

  return true;
}