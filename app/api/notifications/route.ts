<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';

// Initialize Socket.io server
const httpServer = createServer();
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    methods: ['GET', 'POST'],
  },
});

// Store active connections
const connections = new Map();

// Handle WebSocket connections
io.on('connection', (socket) => {
  socket.on('subscribe', async (userId: string) => {
    connections.set(userId, socket);

    // Fetch unread notifications
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Send unread notifications to the client
    socket.emit('notifications', notifications);
  });

  socket.on('disconnect', () => {
    // Remove connection when client disconnects
    for (const [userId, sock] of connections.entries()) {
      if (sock === socket) {
        connections.delete(userId);
        break;
      }
    }
  });
});

// Start the WebSocket server
httpServer.listen(process.env.WEBSOCKET_PORT || 3001);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get notifications for the user
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to latest 50 notifications
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { type, userId, data } = await request.json();

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        type,
        userId,
        data,
      },
    });

    // Send real-time notification if user is connected
    const socket = connections.get(userId);
    if (socket) {
      socket.emit('notification', notification);
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { notificationId } = await request.json();

    // Mark notification as read
    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
      data: {
        read: true,
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
=======
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
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
  }
}