import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { notificationIds, all = false } = body;

    if (all) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    } else if (Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: {
            in: notificationIds,
          },
          userId: session.user.id,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}