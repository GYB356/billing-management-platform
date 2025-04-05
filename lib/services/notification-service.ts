import { prisma } from '@/lib/prisma';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { sendEmail } from '../email';
import { WebPushService } from './web-push-service';
import { createEvent } from '../events';

interface NotificationTemplate {
  subject: string;
  body: string;
  variables: string[];
}

interface NotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  templateId?: string;
  templateData?: Record<string, any>;
}

export class NotificationService {
  private readonly webPushService: WebPushService;
  private readonly templateCache: Map<string, NotificationTemplate>;

  constructor() {
    this.webPushService = new WebPushService();
    this.templateCache = new Map();
  }

  /**
   * Send notification through specified channels
   */
  public async sendNotification(params: NotificationParams) {
    const {
      userId,
      type,
      title,
      message,
      channels = ['IN_APP'],
      data = {},
      priority = 'normal',
      templateId,
      templateData
    } = params;

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        notificationPreferences: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has opted out of this notification type
    if (user.notificationPreferences?.optOutTypes?.includes(type)) {
      return;
    }

    // Get enabled channels based on user preferences
    const enabledChannels = this.getEnabledChannels(channels, user.notificationPreferences);

    // Prepare notification content
    let content = {
      title,
      message
    };

    // Use template if specified
    if (templateId) {
      content = await this.renderTemplate(templateId, templateData || {});
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title: content.title,
        message: content.message,
        data,
        priority,
        channels: enabledChannels,
        status: 'PENDING'
      }
    });

    // Send through each enabled channel
    const deliveryPromises = enabledChannels.map(channel =>
      this.deliverToChannel(notification, channel, user)
    );

    try {
      await Promise.all(deliveryPromises);

      // Update notification status
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' }
      });

      // Create event
      await createEvent({
        type: 'NOTIFICATION_SENT',
        resourceType: 'NOTIFICATION',
        resourceId: notification.id,
        metadata: {
          channels: enabledChannels,
          type
        }
      });
    } catch (error) {
      // Update notification status
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });

      throw error;
    }

    return notification;
  }

  /**
   * Deliver notification through specific channel
   */
  private async deliverToChannel(notification: any, channel: NotificationChannel, user: any) {
    switch (channel) {
      case 'EMAIL':
        if (!user.email) {
          throw new Error('User email not found');
        }
        await this.sendEmailNotification(user.email, notification);
        break;

      case 'SMS':
        if (!user.phoneNumber) {
          throw new Error('User phone number not found');
        }
        await this.sendSMSNotification(user.phoneNumber, notification);
        break;

      case 'PUSH':
        if (!user.pushSubscription) {
          throw new Error('Push subscription not found');
        }
        await this.sendPushNotification(user.pushSubscription, notification);
        break;

      case 'IN_APP':
        await this.createInAppNotification(notification);
        break;

      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }

    // Record delivery
    await prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel,
        status: 'DELIVERED'
      }
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(email: string, notification: any) {
    await sendEmail(email, 'notification', {
      subject: notification.title,
      body: notification.message,
      ...notification.data
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(phoneNumber: string, notification: any) {
    // Implementation would depend on SMS provider
    console.log(`Sending SMS to ${phoneNumber}:`, notification);
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(subscription: any, notification: any) {
    await this.webPushService.sendNotification(subscription, {
      title: notification.title,
      body: notification.message,
      data: notification.data
    });
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(notification: any) {
    await prisma.inAppNotification.create({
      data: {
        userId: notification.userId,
        notificationId: notification.id,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: false
      }
    });
  }

  /**
   * Get notification template
   */
  private async getTemplate(templateId: string): Promise<NotificationTemplate> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    // Get from database
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const parsed = {
      subject: template.subject,
      body: template.body,
      variables: this.extractTemplateVariables(template.body)
    };

    // Cache template
    this.templateCache.set(templateId, parsed);

    return parsed;
  }

  /**
   * Render notification template
   */
  private async renderTemplate(
    templateId: string,
    data: Record<string, any>
  ): Promise<{ title: string; message: string }> {
    const template = await this.getTemplate(templateId);

    // Validate required variables
    const missingVars = template.variables.filter(v => !(v in data));
    if (missingVars.length > 0) {
      throw new Error(`Missing template variables: ${missingVars.join(', ')}`);
    }

    // Render template
    let message = template.body;
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    let title = template.subject;
    for (const [key, value] of Object.entries(data)) {
      title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return { title, message };
  }

  /**
   * Extract variables from template
   */
  private extractTemplateVariables(template: string): string[] {
    const matches = template.match(/{{([^}]+)}}/g) || [];
    return matches.map(m => m.slice(2, -2));
  }

  /**
   * Get enabled notification channels based on user preferences
   */
  private getEnabledChannels(
    requestedChannels: NotificationChannel[],
    preferences: any
  ): NotificationChannel[] {
    if (!preferences || !preferences.channels) {
      return requestedChannels;
    }

    return requestedChannels.filter(channel =>
      preferences.channels.includes(channel)
    );
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string, userId: string) {
    await prisma.inAppNotification.updateMany({
      where: {
        notificationId,
        userId,
        read: false
      },
      data: { 
        read: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Get unread notifications count
   */
  public async getUnreadCount(userId: string): Promise<number> {
    return prisma.inAppNotification.count({
      where: {
        userId,
        read: false
      }
    });
  }

  /**
   * Get user notifications
   */
  public async getUserNotifications(
    userId: string,
    options: {
      read?: boolean;
      type?: NotificationType[];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      read,
      type,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = options;

    return prisma.inAppNotification.findMany({
      where: {
        userId,
        ...(typeof read === 'boolean' ? { read } : {}),
        notification: {
          ...(type ? { type: { in: type } } : {}),
          ...(startDate || endDate ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          } : {})
        }
      },
      include: {
        notification: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });
  }

  /**
   * Update user notification preferences
   */
  public async updateNotificationPreferences(
    userId: string,
    preferences: {
      channels?: NotificationChannel[];
      optOutTypes?: NotificationType[];
      emailFrequency?: 'immediate' | 'daily' | 'weekly';
    }
  ) {
    return prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...preferences
      },
      update: preferences
    });
  }
}