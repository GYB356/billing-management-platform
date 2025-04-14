import { prisma } from '@/lib/prisma';
import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export class SecureAuthService {
  async generateTokens(user: User) {
    const accessToken = sign(
      { userId: user.id, role: user.role },
      JWT_SECRET!,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = sign(
      { userId: user.id, tokenId: randomBytes(32).toString('hex') },
      REFRESH_TOKEN_SECRET!,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return { accessToken, refreshToken };
  }

  async validateAccessToken(token: string): Promise<User | null> {
    try {
      const decoded = verify(token, JWT_SECRET!) as { userId: string };
      return await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
    } catch (error) {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = verify(refreshToken, REFRESH_TOKEN_SECRET!) as { userId: string, tokenId: string };
      
      // Verify token exists in database
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: decoded.userId,
          expiresAt: { gt: new Date() }
        }
      });

      if (!storedToken) {
        throw new Error('Invalid refresh token');
      }

      // Delete old refresh token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });

      // Generate new tokens
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async invalidateSession(userId: string) {
    // Delete all refresh tokens for user
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    // Implement secure password validation
    // This is a placeholder - implement actual password validation
    return true;
  }

  async updatePassword(userId: string, newPassword: string) {
    // Implement secure password update
    // This is a placeholder - implement actual password update
    await prisma.user.update({
      where: { id: userId },
      data: { password: newPassword }
    });
  }
} 