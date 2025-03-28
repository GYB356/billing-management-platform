import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/security';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

export interface SessionDevice {
  id: string;
  deviceName: string;
  lastActive: Date;
  ipAddress: string;
  userAgent: string;
}

export async function createSession(
  userId: string,
  req: NextRequest
): Promise<void> {
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'Unknown';

  await prisma.session.create({
    data: {
      userId,
      deviceName: userAgent,
      ipAddress,
      lastActive: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
}

export async function updateSession(
  sessionId: string,
  req: NextRequest
): Promise<void> {
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'Unknown';

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      lastActive: new Date(),
      ipAddress,
    },
  });
}

export async function getActiveSessions(userId: string): Promise<SessionDevice[]> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActive: 'desc' },
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    lastActive: session.lastActive,
    ipAddress: session.ipAddress,
    userAgent: session.deviceName,
  }));
}

export async function revokeSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

export async function validateSession(
  req: NextRequest
): Promise<boolean> {
  const token = await getToken({ req });
  if (!token) return false;

  const session = await prisma.session.findFirst({
    where: {
      userId: token.sub,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) return false;

  await updateSession(session.id, req);
  return true;
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

// Middleware to check session validity
export async function requireValidSession(
  req: NextRequest
): Promise<void> {
  const isValid = await validateSession(req);
  if (!isValid) {
    throw new ApiError(401, 'Invalid or expired session', 'INVALID_SESSION');
  }
} 