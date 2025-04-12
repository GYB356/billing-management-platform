<<<<<<< HEAD
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { NotificationManager } from '@/lib/notifications/NotificationManager'

const notificationManager = new NotificationManager()

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await notificationManager.getUserPreferences(session.user.id)
    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channels, types } = body

    // Validate input
    if (!Array.isArray(channels) || !Array.isArray(types)) {
      return NextResponse.json(
        { error: 'Invalid input format' },
        { status: 400 }
      )
    }

    // Update preferences
    await notificationManager.updateUserPreferences(session.user.id, {
      channels,
      types
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
=======
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const preferences = await prisma.notificationPreferences.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ preferences });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { type, ...settings } = body;

  const preference = await prisma.notificationPreferences.upsert({
    where: {
      userId_type: {
        userId: session.user.id,
        type: type,
      },
    },
    update: settings,
    create: {
      userId: session.user.id,
      type,
      ...settings,
    },
  });

  return NextResponse.json({ preference });
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
}