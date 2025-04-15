import { prisma } from '@/lib/prisma';
import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { TransactionManager } from '@/utils/TransactionManager';

interface TokenPayload {
  userId: string;
  sessionId: string;
  role: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class SecureAuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string = '15m'; // Short-lived access tokens
  private readonly refreshTokenExpiry: string = '7d'; // Longer-lived refresh tokens

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || '';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || '';

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets not configured');
    }
  }

  async login(userId: string, role: string): Promise<TokenResponse> {
    // Generate a unique session ID
    const sessionId = uuidv4();
    
    // Calculate expiry date for refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    // Create a session record
    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        expiresAt,
        isValid: true
      }
    });
    
    // Generate tokens
    return this.generateTokens({ userId, sessionId, role });
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
    try {
      // Verify refresh token
      const payload = verify(refreshToken, this.refreshTokenSecret) as TokenPayload;
      
      // Check if session is valid
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId }
      });
      
      if (!session || !session.isValid || session.expiresAt < new Date()) {
        return null;
      }
      
      // Invalidate the current session (one-time use refresh token)
      await prisma.session.update({
        where: { id: payload.sessionId },
        data: { isValid: false }
      });
      
      // Create a new session
      return await this.login(payload.userId, payload.role);
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      // Verify access token
      const payload = verify(token, this.accessTokenSecret) as TokenPayload;
      
      // Check if session is valid
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId }
      });
      
      if (!session || !session.isValid || session.expiresAt < new Date()) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  async logout(sessionId: string): Promise<boolean> {
    try {
      // Invalidate the session
      await prisma.session.update({
        where: { id: sessionId },
        data: { isValid: false }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }

  async logoutAllSessions(userId: string): Promise<boolean> {
    try {
      // Invalidate all sessions for the user
      await prisma.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      return false;
    }
  }

  private generateTokens(payload: TokenPayload): TokenResponse {
    // Generate access token (short-lived)
    const accessToken = sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });
    
    // Generate refresh token (longer-lived)
    const refreshToken = sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry
    });
    
    // Calculate expiry timestamp for the client
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    
    return {
      accessToken,
      refreshToken,
      expiresAt
    };
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