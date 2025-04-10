import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { securityMonitoring } from '@/lib/security-monitoring';

const PrivacyRequestSchema = z.object({
  type: z.enum(['ACCESS', 'DELETE', 'MODIFY']),
  regulation: z.enum(['GDPR', 'CCPA']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = PrivacyRequestSchema.parse(body);
    
    const request = await securityMonitoring.handleDataPrivacyRequest(
      session.user.id,
      validatedData.type,
      validatedData.regulation
    );

    return NextResponse.json({ success: true, requestId: request.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await securityMonitoring.getUserDataPrivacyRequests(session.user.id);
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}