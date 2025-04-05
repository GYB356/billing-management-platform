import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';

const notificationSchema = z.object({
  userId: z.string(),
  channel: z.enum(['email', 'sms', 'in-app']),
  message: z.string().min(1, 'Message is required'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = notificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { userId, channel, message } = validationResult.data;

    // Fetch the user
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle notification by channel
    if (channel === 'email') {
      await sendEmail({
        to: user.email,
        subject: 'Notification',
        text: message,
      });
    } else if (channel === 'sms') {
      // Placeholder for SMS sending logic
      console.log(`Sending SMS to ${user.phone}: ${message}`);
    } else if (channel === 'in-app') {
      await prisma.notification.create({
        data: {
          userId: user.id,
          message,
          type: 'INFO',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}