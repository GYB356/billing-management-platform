import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import {
  getSecurityEvents,
  getSuspiciousActivity,
  SecurityEventType,
} from '@/lib/security/logging';
import { getToken } from 'next-auth/jwt';

const querySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  eventType: z.nativeEnum(SecurityEventType).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

// GET /api/admin/security/events - Get security events
export const GET = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const events = await getSecurityEvents(
      query.userId,
      query.startDate,
      query.endDate,
      query.eventType
    );

    return NextResponse.json(events);
  },
  {
    method: 'GET',
  }
);

// GET /api/admin/security/suspicious - Get suspicious activity
export const POST = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const suspiciousActivity = await getSuspiciousActivity(
      query.startDate,
      query.endDate
    );

    return NextResponse.json(suspiciousActivity);
  },
  {
    method: 'POST',
  }
);

// GET /api/admin/security/stats - Get security statistics
export const PUT = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub || token.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const events = await getSecurityEvents(
      query.userId,
      query.startDate,
      query.endDate
    );

    // Calculate statistics
    const stats = {
      totalEvents: events.length,
      eventsByType: events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      eventsBySeverity: events.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      uniqueIPs: new Set(events.map(event => event.ipAddress)).size,
      uniqueUsers: new Set(events.map(event => event.userId).filter(Boolean)).size,
    };

    return NextResponse.json(stats);
  },
  {
    method: 'PUT',
  }
); 