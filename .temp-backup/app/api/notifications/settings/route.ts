import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updating settings
const updateSettingSchema = z.object({
  typeId: z.string(),
  channel: z.enum(['email', 'inApp', 'push']),
  enabled: z.boolean(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's notification preferences
    const settings = await prisma.notificationPreference.findMany({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { typeId, channel, enabled } = updateSettingSchema.parse(body);

    // Update or create notification preference
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_type: {
          userId: session.user.id,
          type: typeId,
        },
      },
      update: {
        [channel]: enabled,
      },
      create: {
        userId: session.user.id,
        type: typeId,
        [channel]: enabled,
      },
    });

    return NextResponse.json(preference);
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channels } = await request.json();
    const userId = session.user.id;

    // Get user's current notification settings
    const settings = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Update settings for all notification types
    await prisma.$transaction(
      settings.map(setting =>
        prisma.notificationPreference.update({
          where: {
            userId_type: {
              userId,
              type: setting.type,
            },
          },
          data: channels.reduce(
            (acc: any, channel: string) => ({
              ...acc,
              [channel]: true,
            }),
            {}
          ),
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification channels:', error);
    return NextResponse.json(
      { error: 'Failed to update notification channels' },
      { status: 500 }
    );
  }
}