import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationIds: z.array(z.string())
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = markReadSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Verify user owns these notifications
    const notifications = await prisma.notification.findMany({
      where: {
        id: {
          in: validatedData.data.notificationIds
        },
        userId: session.user.id
      }
    });

    if (notifications.length !== validatedData.data.notificationIds.length) {
      return NextResponse.json(
        { error: 'One or more notifications not found or not accessible' },
        { status: 404 }
      );
    }

    // Mark notifications as read
    await prisma.notification.updateMany({
      where: {
        id: {
          in: validatedData.data.notificationIds
        },
        userId: session.user.id
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}