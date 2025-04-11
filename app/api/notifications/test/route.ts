import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';

const testNotificationSchema = z.object({
  typeId: z.string(),
});

const notificationTemplates = {
  billing: {
    title: 'Test Billing Notification',
    message: 'This is a test billing notification. If you received this, your billing notifications are working correctly.',
    data: {
      actionUrl: '/customer-portal/billing',
    },
  },
  usage: {
    title: 'Test Usage Alert',
    message: 'This is a test usage alert. If you received this, your usage notifications are working correctly.',
    data: {
      actionUrl: '/customer-portal/usage',
    },
  },
  system: {
    title: 'Test System Notification',
    message: 'This is a test system notification. If you received this, your system notifications are working correctly.',
    data: {
      actionUrl: '/settings',
    },
  },
  security: {
    title: 'Test Security Alert',
    message: 'This is a test security alert. If you received this, your security notifications are working correctly.',
    data: {
      actionUrl: '/settings/security',
    },
  },
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { typeId } = testNotificationSchema.parse(body);

    const template = notificationTemplates[typeId as keyof typeof notificationTemplates];
    if (!template) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    // Get user's notification preferences
    const preferences = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId: session.user.id,
          type: typeId,
        },
      },
    });

    // Create in-app notification if enabled
    if (preferences?.inApp ?? true) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: typeId,
          title: template.title,
          message: template.message,
          data: template.data,
        },
      });
    }

    // Send email notification if enabled
    if (preferences?.email ?? true) {
      await sendEmail({
        to: session.user.email!,
        subject: template.title,
        html: `
          <h1>${template.title}</h1>
          <p>${template.message}</p>
          <p>This is a test notification sent from your billing platform.</p>
          ${template.data?.actionUrl ? 
            `<a href="${process.env.NEXT_PUBLIC_APP_URL}${template.data.actionUrl}">View Details</a>` 
            : ''}
        `,
      });
    }

    // Send push notification if enabled
    if (preferences?.push ?? true) {
      // Implement push notification logic here when push notifications are supported
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}