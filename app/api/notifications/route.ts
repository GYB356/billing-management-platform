import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const userId = searchParams.get('userId') || session.user.id;
    const limit = Number(searchParams.get('limit')) || 10;
    const offset = Number(searchParams.get('offset')) || 0;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    const where = {
      OR: [
        { userId },
        { organizationId: organizationId || undefined },
      ],
      ...(unreadOnly ? { read: false } : {}),
    };
    
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);
    
    return NextResponse.json({
      notifications,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await req.json();
    const { id, read } = data;
    
    if (id === undefined || read === undefined) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    
    // Check if the user has access to this notification
    if (
      notification.userId !== session.user.id &&
      notification.organizationId !== session.user.organizationId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { read },
    });
    
    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}