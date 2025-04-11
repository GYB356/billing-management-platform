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
  }
}