import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { checkAndSendAlerts } from './alerts';
import { PrismaClient } from '@prisma/client';
import { SecurityEvent } from '@/types/security';

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

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export async function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await prisma.securityEvent.create({ data: { ...event, timestamp: new Date() } });

    // Check for suspicious activity patterns
    await checkSuspiciousActivity(event);
    
    // Check and send alerts
    await checkAndSendAlerts(event);
  } catch (error) {
    console.error('Failed to log security event:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkSuspiciousActivity(data: SecurityEventData): Promise<void> {
  const recentEvents = await prisma.securityEvent.findMany({
    where: {
      ipAddress: data.ipAddress,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Check for multiple failed login attempts
  const failedLogins = recentEvents.filter(
    (event) => event.eventType === SecurityEventType.LOGIN_FAILURE
  );

  if (failedLogins.length >= 5) {
    await logSecurityEvent({
      ...data,
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      details: {
        reason: 'Multiple failed login attempts',
        failedAttempts: failedLogins.length,
      },
      severity: 'HIGH',
    });
  }

  // Check for rapid password changes
  const passwordChanges = recentEvents.filter(
    (event) => event.eventType === SecurityEventType.PASSWORD_CHANGE
  );

  if (passwordChanges.length >= 3) {
    await logSecurityEvent({
      ...data,
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      details: {
        reason: 'Multiple password changes',
        changes: passwordChanges.length,
      },
      severity: 'MEDIUM',
    });
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
    ipAddress,
    userAgent,
    eventType: SecurityEventType.SESSION_EXPIRED,
    details: {
      path: req.nextUrl.pathname,
      method: req.method,
    },
    severity: 'LOW',
  });
} 