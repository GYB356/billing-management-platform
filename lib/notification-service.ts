import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { NotificationType } from '@prisma/client';

export interface NotificationTemplate {
  title: string;
  message: string;
  data?: Record<string, any>;
  emailTemplate?: string;
}

export interface NotificationOptions {
  userId: string;
  type: NotificationType;
  title?: string;
  message?: string;
  data?: Record<string, any>;
  channels?: Array<'email' | 'inApp' | 'push'>;
  emailTemplate?: string;
}

const defaultTemplates: Record<NotificationType, NotificationTemplate> = {
  BILLING: {
    title: 'Billing Update',
    message: 'There has been an update to your billing information.',
    emailTemplate: 'billing-notification',
  },
  USAGE: {
    title: 'Usage Alert',
    message: 'Your usage has reached a monitored threshold.',
    emailTemplate: 'usage-alert',
  },
  SYSTEM: {
    title: 'System Notification',
    message: 'Important system update.',
    emailTemplate: 'system-notification',
  },
  SECURITY: {
    title: 'Security Alert',
    message: 'Important security update for your account.',
    emailTemplate: 'security-alert',
  },
};

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async send({
    userId,
    type,
    title,
    message,
    data,
    channels = ['inApp', 'email'],
    emailTemplate,
  }: NotificationOptions): Promise<void> {
    try {
      // Get user's notification preferences
      const preferences = await prisma.notificationPreference.findUnique({
        where: {
          userId_type: {
            userId,
            type,
          },
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get template
      const template = defaultTemplates[type];
      const finalTitle = title || template.title;
      const finalMessage = message || template.message;
      const finalData = { ...template.data, ...data };
      const finalEmailTemplate = emailTemplate || template.emailTemplate;

      // Create in-app notification if enabled
      if (channels.includes('inApp') && (preferences?.inApp ?? true)) {
        await prisma.notification.create({
          data: {
            userId,
            type,
            title: finalTitle,
            message: finalMessage,
            data: finalData,
          },
        });
      }

      // Send email notification if enabled
      if (channels.includes('email') && (preferences?.email ?? true) && user.email) {
        await this.sendEmailNotification({
          to: user.email,
          type,
          title: finalTitle,
          message: finalMessage,
          data: finalData,
          template: finalEmailTemplate,
        });
      }

      // Send push notification if enabled
      if (channels.includes('push') && (preferences?.push ?? true)) {
        await this.sendPushNotification({
          userId,
          type,
          title: finalTitle,
          message: finalMessage,
          data: finalData,
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  private async sendEmailNotification({
    to,
    type,
    title,
    message,
    data,
    template,
  }: {
    to: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    template?: string;
  }) {
    const defaultHtml = `
      <h1>${title}</h1>
      <p>${message}</p>
      ${data?.actionUrl ? 
        `<a href="${process.env.NEXT_PUBLIC_APP_URL}${data.actionUrl}">View Details</a>` 
        : ''}
    `;

    await sendEmail({
      to,
      subject: title,
      html: defaultHtml,
      template,
      data: {
        title,
        message,
        ...data,
      },
    });
  }

  private async sendPushNotification({
    userId,
    type,
    title,
    message,
    data,
  }: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }) {
    // Implement push notification logic here when supported
    // This could integrate with web push notifications, mobile push notifications, etc.
    console.log('Push notification not implemented yet');
  }

  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      unreadOnly?: boolean;
    } = {}
  ) {
    const {
      page = 1,
      limit = 10,
      type,
      unreadOnly = false,
    } = options;

    const where = {
      userId,
      ...(type && { type }),
      ...(unreadOnly && { readAt: null }),
    };

    const [total, notifications] = await prisma.$transaction([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' as const },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationIds: string[]): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async handleIterationResponse(
    notificationId: string,
    userId: string,
    willIterate: boolean
  ) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        iterationResponse: willIterate,
        iterationRespondedAt: new Date(),
        status: willIterate ? 'ITERATION_APPROVED' : 'ITERATION_DECLINED'
      }
    });

    if (willIterate) {
      await this.createIterationNotification(notification, userId);
    }
  }

  private async createIterationNotification(
    originalNotification: any,
    userId: string
  ) {
    const iterationCount = (originalNotification.iterationCount || 0) + 1;
    
    await prisma.notification.create({
      data: {
        title: `Iteration ${iterationCount}: ${originalNotification.title}`,
        content: originalNotification.content,
        type: originalNotification.type,
        priority: originalNotification.priority,
        userId,
        iterationCount,
        originalNotificationId: originalNotification.id,
        status: 'PENDING'
      }
    });
  }
}

export const notificationService = NotificationService.getInstance();