import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function GET() {
  try {
    const identifier = 'user-me'
    const session = await getServerSession(authOptions);

    const userId = session?.user.id || '';

    await rateLimit(userId ? `${identifier}-${userId}` : identifier);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });      
    }
    return NextResponse.json({ user: session.user });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 