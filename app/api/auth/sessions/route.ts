import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import {
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
} from '@/lib/auth/session';
import { getToken } from 'next-auth/jwt';

// GET /api/auth/sessions - List active sessions
export const GET = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const sessions = await getActiveSessions(token.sub);
    return NextResponse.json(sessions);
  },
  {
    method: 'GET',
  }
);

// DELETE /api/auth/sessions/:id - Revoke a specific session
export const DELETE = createHandler(
  async (req, params) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    const sessionId = params.id as string;
    await revokeSession(token.sub, sessionId);

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'DELETE',
  }
);

// DELETE /api/auth/sessions - Revoke all sessions
export const POST = createHandler(
  async (req) => {
    const token = await getToken({ req });
    if (!token?.sub) {
      throw new Error('Unauthorized');
    }

    await revokeAllSessions(token.sub);

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'POST',
  }
); 