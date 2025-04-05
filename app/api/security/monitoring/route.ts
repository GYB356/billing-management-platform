import { NextResponse } from 'next/server';
import { SecurityMonitoringService } from '@/services/security-monitoring';
import { validateSession } from '@/lib/auth';
import { z } from 'zod';

const securityMonitoring = new SecurityMonitoringService();

const securityEventSchema = z.object({
  type: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  metadata: z.record(z.any())
});

const updateAlertSchema = z.object({
  alertId: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
});

export async function POST(req: Request) {
  try {
    const session = await validateSession(req);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validated = securityEventSchema.parse(body);
    
    const event = await securityMonitoring.logSecurityEvent(
      validated.type,
      validated.severity,
      validated.metadata
    );

    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to log security event' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await validateSession(req);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = new Date(searchParams.get('startDate') || '');
    const endDate = new Date(searchParams.get('endDate') || '');

    if (searchParams.get('type') === 'alerts') {
      const alerts = await securityMonitoring.getActiveAlerts();
      return NextResponse.json(alerts);
    } else {
      const events = await securityMonitoring.getSecurityEvents(startDate, endDate);
      return NextResponse.json(events);
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch security data' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await validateSession(req);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateAlertSchema.parse(body);
    
    const alert = await securityMonitoring.updateAlertStatus(
      validated.alertId,
      validated.status
    );

    return NextResponse.json(alert);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update alert status' },
      { status: 500 }
    );
  }
}