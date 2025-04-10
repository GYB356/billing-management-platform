import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityMonitoring } from '@/lib/security-monitoring';
import { z } from 'zod';

const QueryParamsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view logs
    const hasAccess = await securityMonitoring.checkPermission(session.user.id, 'view:analytics');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const validatedParams = QueryParamsSchema.parse(Object.fromEntries(searchParams));

    const filters = {
      ...(validatedParams.startDate && { startDate: new Date(validatedParams.startDate) }),
      ...(validatedParams.endDate && { endDate: new Date(validatedParams.endDate) }),
      ...(validatedParams.userId && { userId: validatedParams.userId }),
      ...(validatedParams.action && { action: validatedParams.action }),
    };

    const logs = await securityMonitoring.getActivityLogs(
      session.user.organizationId,
      filters
    );

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create logs
    const hasAccess = await securityMonitoring.checkPermission(session.user.id, 'manage:settings');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    await securityMonitoring.logActivityEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      ...body,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}