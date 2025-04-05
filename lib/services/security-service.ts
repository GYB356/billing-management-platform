import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
};

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxHistory: 5,
  maxAge: 90, // days
};

// Session configuration
const SESSION_CONFIG = {
  maxConcurrentSessions: 5,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  requireReauthAfter: 12 * 60 * 60 * 1000, // 12 hours
};

export class SecurityService {
  /**
   * Enable 2FA for a user
   */
  static async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      // Generate secret
      const secret = authenticator.generateSecret();

      // Store secret in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret,
          twoFactorEnabled: true,
        },
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(
        authenticator.keyuri(
          userId,
          'BillingPlatform',
          secret
        )
      );

      // Log event
      await createEvent({
        eventType: 'TWO_FACTOR_ENABLED',
        resourceType: 'USER',
        resourceId: userId,
        severity: EventSeverity.INFO,
      });

      return { secret, qrCode };
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      await createEvent({
        eventType: 'TWO_FACTOR_ENABLE_ERROR',
        resourceType: 'USER',
        resourceId: userId,
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Verify 2FA token
   */
  static async verify2FA(userId: string, token: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true },
      });

      if (!user?.twoFactorSecret) {
        return false;
      }

      const isValid = authenticator.verify({
        token,
        secret: user.twoFactorSecret,
      });

      // Log verification attempt
      await createEvent({
        eventType: isValid ? 'TWO_FACTOR_VERIFIED' : 'TWO_FACTOR_FAILED',
        resourceType: 'USER',
        resourceId: userId,
        severity: isValid ? EventSeverity.INFO : EventSeverity.WARNING,
      });

      return isValid;
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      await createEvent({
        eventType: 'TWO_FACTOR_VERIFY_ERROR',
        resourceType: 'USER',
        resourceId: userId,
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  /**
   * Validate password against policy
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < PASSWORD_POLICY.minLength) {
      errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
    }
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (PASSWORD_POLICY.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if password has been used before
   */
  static async isPasswordPreviouslyUsed(userId: string, password: string): Promise<boolean> {
    try {
      const passwordHistory = await prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: PASSWORD_POLICY.maxHistory,
      });

      return passwordHistory.some(record => 
        bcrypt.compareSync(password, record.hashedPassword)
      );
    } catch (error) {
      console.error('Error checking password history:', error);
      return false;
    }
  }

  /**
   * Create API key
   */
  static async createApiKey(userId: string, name: string, permissions: string[]): Promise<string> {
    try {
      const key = crypto.randomBytes(32).toString('hex');
      const hashedKey = await bcrypt.hash(key, 10);

      await prisma.apiKey.create({
        data: {
          userId,
          name,
          key: hashedKey,
          permissions,
          lastUsed: null,
        },
      });

      // Log event
      await createEvent({
        eventType: 'API_KEY_CREATED',
        resourceType: 'API_KEY',
        userId,
        severity: EventSeverity.INFO,
        metadata: {
          name,
          permissions,
        },
      });

      return key;
    } catch (error) {
      console.error('Error creating API key:', error);
      await createEvent({
        eventType: 'API_KEY_CREATION_ERROR',
        resourceType: 'API_KEY',
        userId,
        severity: EventSeverity.ERROR,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  static async validateApiKey(key: string): Promise<{
    isValid: boolean;
    userId?: string;
    permissions?: string[];
  }> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          key: {
            equals: key,
          },
        },
      });

      if (!apiKey) {
        return { isValid: false };
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsed: new Date() },
      });

      return {
        isValid: true,
        userId: apiKey.userId,
        permissions: apiKey.permissions,
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { isValid: false };
    }
  }

  /**
   * Check rate limit for IP
   */
  static async checkRateLimit(ip: string): Promise<{
    allowed: boolean;
    remaining: number;
    reset: Date;
  }> {
    try {
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

      const requestCount = await prisma.rateLimit.count({
        where: {
          ip,
          timestamp: {
            gte: new Date(windowStart),
          },
        },
      });

      const remaining = Math.max(0, RATE_LIMIT_CONFIG.max - requestCount);
      const reset = new Date(now + RATE_LIMIT_CONFIG.windowMs);

      // Log rate limit check
      if (requestCount >= RATE_LIMIT_CONFIG.max) {
        await createEvent({
          eventType: 'RATE_LIMIT_EXCEEDED',
          severity: EventSeverity.WARNING,
          metadata: {
            ip,
            requestCount,
          },
        });
      }

      return {
        allowed: requestCount < RATE_LIMIT_CONFIG.max,
        remaining,
        reset,
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.max,
        reset: new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs),
      };
    }
  }

  /**
   * Record rate limit request
   */
  static async recordRateLimitRequest(ip: string): Promise<void> {
    try {
      await prisma.rateLimit.create({
        data: {
          ip,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error recording rate limit request:', error);
    }
  }

  /**
   * Clean up old rate limit records
   */
  static async cleanupRateLimits(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - RATE_LIMIT_CONFIG.windowMs);
      await prisma.rateLimit.deleteMany({
        where: {
          timestamp: {
            lt: cutoff,
          },
        },
      });
    } catch (error) {
      console.error('Error cleaning up rate limits:', error);
    }
  }
} 