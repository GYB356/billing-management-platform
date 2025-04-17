import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { checkAndSendAlerts } from './alerts';
import { PrismaClient } from '@prisma/client';
import { SecurityEvent } from '@/types/security';
import { withRetry } from '@/lib/utils/async';

export enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface SecurityEventData {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logSecurityEvent(event: SecurityEventData): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await withRetry(
      async () => {
        await prisma.securityEvent.create({
          data: {
            type: event.type,
            severity: event.severity,
            userId: event.userId,
            metadata: {
              ipAddress: event.ipAddress,
              userAgent: event.userAgent,
              ...event.metadata,
              timestamp: new Date().toISOString(),
            },
          },
        });
      },
      3, // Number of retries
      1000 // Delay between retries in ms
    );

    // Check for suspicious activity patterns
    if (event.userId) {
      await checkSuspiciousActivity({
        userId: event.userId,
        ipAddress: event.ipAddress,
        type: event.type,
      });
    }
  } catch (error) {
    console.error('Failed to log security event:', error instanceof Error ? error.message : 'Unknown error');
    // Re-throw critical security events
    if (event.severity === SecurityEventSeverity.CRITICAL) {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

interface SuspiciousActivityCheck {
  userId: string;
  ipAddress?: string;
  type: SecurityEventType;
}

async function checkSuspiciousActivity(data: SuspiciousActivityCheck): Promise<void> {
  const prisma = new PrismaClient();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  try {
    const recentEvents = await prisma.securityEvent.findMany({
      where: {
        userId: data.userId,
        metadata: data.ipAddress ? {
          path: ['ipAddress'],
          equals: data.ipAddress,
        } : undefined,
        createdAt: {
          gte: new Date(Date.now() - TWENTY_FOUR_HOURS),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Check for multiple failed login attempts
    if (data.type === SecurityEventType.LOGIN_FAILURE) {
      const failedLogins = recentEvents.filter(
        (event) => event.type === SecurityEventType.LOGIN_FAILURE
      );

      if (failedLogins.length >= 5) {
        await logSecurityEvent({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecurityEventSeverity.HIGH,
          userId: data.userId,
          ipAddress: data.ipAddress,
          metadata: {
            reason: 'Multiple failed login attempts',
            failedAttempts: failedLogins.length,
          },
        });
      }
    }

    // Check for rapid password changes
    if (data.type === SecurityEventType.PASSWORD_CHANGE) {
      const passwordChanges = recentEvents.filter(
        (event) => event.type === SecurityEventType.PASSWORD_CHANGE
      );

      if (passwordChanges.length >= 3) {
        await logSecurityEvent({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecurityEventSeverity.MEDIUM,
          userId: data.userId,
          ipAddress: data.ipAddress,
          metadata: {
            reason: 'Multiple password changes',
            changes: passwordChanges.length,
          },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function getSecurityEvents(
  filters: Partial<SecurityEvent> = {},
  limit: number = 100
): Promise<SecurityEvent[]> {
  const prisma = new PrismaClient();
  try {
    const events = await prisma.securityEvent.findMany({
      where: filters,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return events;
  } finally {
    await prisma.$disconnect();
  }
}

export async function getSuspiciousActivity(
  startDate?: Date,
  endDate?: Date
) {
  return prisma.securityEvent.findMany({
    where: {
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Middleware to log request details
export async function logRequest(req: NextRequest): Promise<void> {
  const ipAddress = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  await logSecurityEvent({
    type: SecurityEventType.SESSION_EXPIRED,
    severity: SecurityEventSeverity.LOW,
    ipAddress,
    userAgent,
    metadata: {
      path: req.nextUrl.pathname,
      method: req.method,
    },
  });
} 