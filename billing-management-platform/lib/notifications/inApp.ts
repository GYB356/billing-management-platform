import { NotificationTemplate } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { pusher } from '@/lib/pusher';

export async function sendInApp(
  userId: string,
  template: NotificationTemplate,
  data: Record<string, any>
) {
  const title = template.subject.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");
  const content = template.body.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");

  // Save to user-facing in-app messages
  const message = await prisma.message.create({
    data: {
      userId,
      title,
      content,
    },
  });

  // Send real-time notification via Pusher
  await pusher.trigger(`user-${userId}`, 'notification', {
    id: message.id,
    title,
    content,
    timestamp: new Date().toISOString(),
  });
} 