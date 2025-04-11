import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { sendInApp } from "@/lib/notifications/inApp";

export type NotificationChannel = 'email' | 'in-app' | 'sms';

export interface NotificationData {
  userId: string;
  templateType: string;
  data: Record<string, any>;
}

export async function dispatchNotification({
  userId,
  templateType,
  data,
}: NotificationData) {
  // Find the notification template
  const template = await prisma.notificationTemplate.findFirst({
    where: { type: templateType },
  });

  if (!template) {
    throw new Error(`Template not found for type: ${templateType}`);
  }

  // Create and dispatch notifications for each channel
  const notifications = await Promise.all(
    template.channels.map(async (channel) => {
      // Create notification record
      const notification = await prisma.notification.create({
        data: {
          userId,
          templateId: template.id,
          channel,
          status: "pending",
          data,
        },
      });

      try {
        // Dispatch based on channel type
        switch (channel) {
          case 'email':
            await sendEmail(userId, template, data);
            break;
          case 'in-app':
            await sendInApp(userId, template, data);
            break;
          case 'sms':
            // SMS implementation would go here
            throw new Error('SMS notifications not implemented');
          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        // Update notification status to sent
        await prisma.notification.update({
          where: { id: notification.id },
          data: { 
            status: "sent",
            sentAt: new Date()
          },
        });

        return {
          success: true,
          notificationId: notification.id,
          channel,
        };
      } catch (error) {
        // Update notification status to failed
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "failed" },
        });

        console.error(`Failed to send ${channel} notification:`, error);
        return {
          success: false,
          notificationId: notification.id,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return notifications;
} 