/**
 * Enhanced notification service with multi-channel support and preference management
 */

import { prisma } from '../prisma';
import { Resend } from 'resend';
import { createEvent, EventSeverity } from '../events';
import { NotificationType, User, Organization } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

// Initialize email client
const resend = new Resend(process.env.RESEND_API_KEY);

// Notification delivery channels
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK'
}

// Notification priority levels
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Notification categories
export enum NotificationCategory {
  BILLING = 'BILLING',
  SUBSCRIPTION = 'SUBSCRIPTION',
  ACCOUNT = 'ACCOUNT',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  MARKETING = 'MARKETING'
}

// Notification template data
export interface NotificationTemplateData {
  [key: string]: any;
}

// Notification creation parameters
export interface CreateNotificationParams {
  userId?: string;
  organizationId?: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  link?: string;
  channels?: NotificationChannel[];
  templateId?: string;
  templateData?: NotificationTemplateData;
}

// Notification preferences structure
export interface NotificationPreferences {
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      channels: NotificationChannel[];
      minPriority?: NotificationPriority;
    };
  };
  channels: {
    [key in NotificationChannel]?: {
      enabled: boolean;
      schedule?: {
        type: 'immediate' | 'digest';
        frequency?: 'daily' | 'weekly';
        time?: string; // HH:MM format
        days?: number[]; // 0-6 (Sunday to Saturday)
      };
    };
  };
  mutedUntil?: Date;
  doNotDisturb?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timeZone: string;
    days: number[]; // 0-6 (Sunday to Saturday)
  };
}

// Webhook configuration
export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  events: string[];
}

export class NotificationService {
  /**
   * Create a notification
   */
  static async createNotification(params: CreateNotificationParams) {
    try {
      const {
        userId,
        organizationId,
        title,
        message,
        type,
        category,
        priority = NotificationPriority.MEDIUM,
        data = {},
        link,
        channels = [NotificationChannel.IN_APP],
        templateId,
        templateData
      } = params;

      // Validate required parameters
      if (!userId && !organizationId) {
        throw new Error('Either userId or organizationId must be provided');
      }

      // Resolve recipients based on userId or organizationId
      let recipientUser: User | null = null;
      let recipientOrg: Organization | null = null;
      let recipients: User[] = [];

      if (userId) {
        recipientUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!recipientUser) {
          throw new Error(`User with ID ${userId} not found`);
        }

        recipients = [recipientUser];
      } else if (organizationId) {
        recipientOrg = await prisma.organization.findUnique({
          where: { id: organizationId },
          include: {
            userOrganizations: {
              include: {
                user: true
              }
            }
          }
        });

        if (!recipientOrg) {
          throw new Error(`Organization with ID ${organizationId} not found`);
        }

        recipients = recipientOrg.userOrganizations.map(uo => uo.user);
      }

      // Process notification template if provided
      let processedTitle = title;
      let processedMessage = message;

      if (templateId && templateData) {
        const template = await this.getNotificationTemplate(templateId);
        
        if (template) {
          processedTitle = this.processTemplate(template.titleTemplate, templateData);
          processedMessage = this.processTemplate(template.bodyTemplate, templateData);
        }
      }

      // Create notifications for each recipient
      const notificationPromises = [];

      for (const recipient of recipients) {
        // Apply user notification preferences
        const userPrefs = await this.getUserPreferences(recipient.id);
        const effectiveChannels = this.applyPreferences(
          channels,
          category,
          priority,
          userPrefs
        );
        
        // Skip if no channels are enabled after applying preferences
        if (effectiveChannels.length === 0) {
          continue;
        }
        
        // Create the notification record
        const notification = await prisma.notification.create({
          data: {
            userId: recipient.id,
            organizationId,
            title: processedTitle,
            message: processedMessage,
            type,
            read: false,
            link,
            data: {
              ...data,
              category,
              priority,
              channels: effectiveChannels,
              createdAt: new Date()
            }
          }
        });

        // Deliver through each channel
        for (const channel of effectiveChannels) {
          notificationPromises.push(
            this.deliverNotification(notification, channel, recipient, recipientOrg)
          );
        }
      }

      // Wait for all notification deliveries to complete
      await Promise.allSettled(notificationPromises);

      // Create audit event
      await createEvent({
        eventType: 'NOTIFICATION_SENT',
        resourceType: 'NOTIFICATION',
        userId,
        organizationId,
        severity: 
          priority === NotificationPriority.URGENT ? EventSeverity.CRITICAL :
          priority === NotificationPriority.HIGH ? EventSeverity.WARNING :
          EventSeverity.INFO,
        metadata: {
          title: processedTitle,
          type,
          category,
          priority,
          recipientCount: recipients.length
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to create notification:', error);
      
      // Log error event
      await createEvent({
        eventType: 'NOTIFICATION_FAILED',
        resourceType: 'NOTIFICATION',
        severity: EventSeverity.ERROR,
        metadata: {
          error: (error as Error).message,
          params
        }
      });
      
      throw error;
    }
  }

  /**
   * Deliver notification through a specific channel
   */
  private static async deliverNotification(
    notification: any,
    channel: NotificationChannel,
    user: User,
    organization: Organization | null
  ) {
    try {
      switch (channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(notification, user, organization);
          break;
        
        case NotificationChannel.SMS:
          await this.sendSmsNotification(notification, user);
          break;
        
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification, user);
          break;
        
        case NotificationChannel.WEBHOOK:
          if (organization) {
            await this.sendWebhookNotification(notification, organization);
          }
          break;
        
        // IN_APP notifications are already created in the database
      }
      
      // Update notification record with delivery status
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          data: {
            ...notification.data,
            deliveries: {
              ...(notification.data.deliveries || {}),
              [channel]: {
                status: 'SENT',
                timestamp: new Date()
              }
            }
          }
        }
      });
    } catch (error) {
      console.error(`Failed to deliver notification via ${channel}:`, error);
      
      // Update notification with error
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          data: {
            ...notification.data,
            deliveries: {
              ...(notification.data.deliveries || {}),
              [channel]: {
                status: 'FAILED',
                error: (error as Error).message,
                timestamp: new Date()
              }
            }
          }
        }
      });
      
      // Log error event
      await createEvent({
        eventType: 'NOTIFICATION_DELIVERY_FAILED',
        resourceType: 'NOTIFICATION',
        resourceId: notification.id,
        userId: user.id,
        organizationId: organization?.id,
        severity: EventSeverity.WARNING,
        metadata: {
          channel,
          error: (error as Error).message
        }
      });
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    notification: any,
    user: User,
    organization: Organization | null
  ) {
    if (!user.email) {
      throw new Error('User has no email address');
    }

    // Get notification category icon
    const categoryIcon = this.getCategoryIcon(notification.data.category);
    
    // Get notification priority style
    const priorityStyle = this.getPriorityStyle(notification.data.priority);
    
    // Format email body
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${organization ? `<h2 style="color: #333;">${organization.name}</h2>` : ''}
          <div style="font-size: 24px; margin: 10px 0;">${categoryIcon}</div>
        </div>
        
        <div style="background-color: ${priorityStyle.bgColor}; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <h2 style="color: ${priorityStyle.textColor}; margin-top: 0;">${notification.title}</h2>
          <p style="color: ${priorityStyle.textColor};">${notification.message}</p>
        </div>
        
        ${notification.link ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${notification.link}" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Details</a>
        </div>
        ` : ''}
        
        <div style="color: #888; font-size: 12px; margin-top: 30px; border-top: 1px solid #e1e1e1; padding-top: 15px;">
          <p>This notification was sent to ${user.email}</p>
          <p>To manage your notification preferences, <a href="${process.env.APP_URL}/settings/notifications" style="color: #4A90E2;">click here</a>.</p>
        </div>
      </div>
    `;
    
    // Send email
    const result = await resend.emails.send({
      from: `Billing Platform <${process.env.EMAIL_FROM || 'notifications@billingplatform.com'}>`,
      to: user.email,
      subject: notification.title,
      html: emailHtml,
      text: `${notification.title}\n\n${notification.message}${notification.link ? `\n\nView details: ${notification.link}` : ''}`
    });
    
    return result;
  }

  /**
   * Send SMS notification
   */
  private static async sendSmsNotification(notification: any, user: User) {
    // Implementation would connect to an SMS provider like Twilio
    // This is a placeholder implementation
    console.log(`[SMS] To: ${user.phone}, Message: ${notification.title} - ${notification.message}`);
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(notification: any, user: User) {
    // Implementation would connect to a push notification service like Firebase
    // This is a placeholder implementation
    console.log(`[PUSH] To: User ${user.id}, Title: ${notification.title}, Body: ${notification.message}`);
  }

  /**
   * Send webhook notification
   */
  private static async sendWebhookNotification(notification: any, organization: Organization) {
    // Get organization webhooks
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: organization.id,
        events: {
          has: 'notification.created'
        },
        active: true
      }
    });
    
    if (webhooks.length === 0) {
      return;
    }
    
    // Prepare webhook payload
    const payload = {
      id: notification.id,
      type: 'notification.created',
      created: new Date().toISOString(),
      data: {
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category: notification.data.category,
          priority: notification.data.priority,
          link: notification.link,
          created_at: notification.createdAt
        }
      }
    };
    
    // Send to all registered webhooks
    const results = await Promise.allSettled(
      webhooks.map(webhook => {
        // Generate signature if webhook has a secret
        const signature = webhook.secret
          ? this.generateWebhookSignature(JSON.stringify(payload), webhook.secret)
          : undefined;
        
        // Send the webhook
        return fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-Signature': signature } : {}),
            ...(webhook.headers || {})
          },
          body: JSON.stringify(payload)
        });
      })
    );
    
    // Process results
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    if (successCount < webhooks.length) {
      throw new Error(`Failed to deliver webhooks to ${webhooks.length - successCount} endpoints`);
    }
    
    return { success: true, sent: successCount };
  }

  /**
   * Generate webhook signature
   */
  private static generateWebhookSignature(payload: string, secret: string): string {
    // In a real implementation, this would use crypto to generate HMAC
    return `signature-placeholder-${Date.now()}`;
  }

  /**
   * Process a notification template
   */
  private static processTemplate(template: string, data: NotificationTemplateData): string {
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? data[trimmedKey] : match;
    });
  }

  /**
   * Get notification template by ID
   */
  private static async getNotificationTemplate(templateId: string) {
    return prisma.notificationTemplate.findUnique({
      where: { id: templateId }
    });
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preference: true
      }
    });
    
    // Get preferences from user record, or use defaults
    const userPrefs = user?.preference?.notificationPreferences as NotificationPreferences;
    
    if (userPrefs) {
      return userPrefs;
    }
    
    // Return default preferences
    return this.getDefaultPreferences();
  }

  /**
   * Get default notification preferences
   */
  static getDefaultPreferences(): NotificationPreferences {
    return {
      categories: {
        [NotificationCategory.BILLING]: {
          enabled: true,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        },
        [NotificationCategory.SUBSCRIPTION]: {
          enabled: true,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        },
        [NotificationCategory.ACCOUNT]: {
          enabled: true,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        },
        [NotificationCategory.SECURITY]: {
          enabled: true,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS]
        },
        [NotificationCategory.SYSTEM]: {
          enabled: true,
          channels: [NotificationChannel.IN_APP]
        },
        [NotificationCategory.MARKETING]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL]
        }
      },
      channels: {
        [NotificationChannel.IN_APP]: {
          enabled: true
        },
        [NotificationChannel.EMAIL]: {
          enabled: true
        },
        [NotificationChannel.SMS]: {
          enabled: true
        },
        [NotificationChannel.PUSH]: {
          enabled: true
        },
        [NotificationChannel.WEBHOOK]: {
          enabled: true
        }
      }
    };
  }

  /**
   * Update user notification preferences
   */
  static async updateUserPreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    // Validate preferences
    this.validatePreferences(preferences);
    
    // Update user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        preference: {
          upsert: {
            create: {
              notificationPreferences: preferences
            },
            update: {
              notificationPreferences: preferences
            }
          }
        }
      }
    });
  }

  /**
   * Validate notification preferences
   */
  private static validatePreferences(preferences: NotificationPreferences): void {
    // Check if preferences are valid
    // In a real implementation, this would validate all fields
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Invalid preferences format');
    }
  }

  /**
   * Apply user preferences to notification channels
   */
  private static applyPreferences(
    channels: NotificationChannel[],
    category: NotificationCategory,
    priority: NotificationPriority,
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    // If user has muted notifications, only allow urgent notifications
    if (preferences.mutedUntil && new Date() < new Date(preferences.mutedUntil)) {
      if (priority !== NotificationPriority.URGENT) {
        return [NotificationChannel.IN_APP]; // Only store in-app when muted
      }
    }

    // Check Do Not Disturb settings
    if (preferences.doNotDisturb?.enabled) {
      const dnd = preferences.doNotDisturb;
      const now = new Date();
      const day = now.getDay();
      
      // Check if today is in DND days
      if (dnd.days.includes(day)) {
        // Parse times
        const [startHour, startMinute] = dnd.startTime.split(':').map(Number);
        const [endHour, endMinute] = dnd.endTime.split(':').map(Number);
        
        const startTime = new Date(now);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);
        
        // If current time is in DND window, only allow in-app and urgent notifications
        if (now >= startTime && now <= endTime && priority !== NotificationPriority.URGENT) {
          return [NotificationChannel.IN_APP];
        }
      }
    }
    
    // Check if this category is enabled
    const categoryPrefs = preferences.categories[category];
    if (!categoryPrefs?.enabled) {
      return [NotificationChannel.IN_APP]; // Always store in-app
    }
    
    // Check if priority is high enough
    if (categoryPrefs.minPriority) {
      const priorityLevels = [
        NotificationPriority.LOW,
        NotificationPriority.MEDIUM,
        NotificationPriority.HIGH,
        NotificationPriority.URGENT
      ];
      
      const minIndex = priorityLevels.indexOf(categoryPrefs.minPriority);
      const currentIndex = priorityLevels.indexOf(priority);
      
      if (currentIndex < minIndex) {
        return [NotificationChannel.IN_APP];
      }
    }
    
    // Filter channels based on user preferences
    const enabledChannels = channels.filter(channel => {
      // Check if channel exists in category preferences
      if (categoryPrefs.channels && !categoryPrefs.channels.includes(channel)) {
        return false;
      }
      
      // Check if channel is enabled globally
      if (preferences.channels[channel]?.enabled === false) {
        return false;
      }
      
      return true;
    });
    
    // Always include in-app notifications
    if (!enabledChannels.includes(NotificationChannel.IN_APP)) {
      enabledChannels.push(NotificationChannel.IN_APP);
    }
    
    return enabledChannels;
  }

  /**
   * Get category icon for emails
   */
  private static getCategoryIcon(category: NotificationCategory): string {
    switch (category) {
      case NotificationCategory.BILLING:
        return '💰';
      case NotificationCategory.SUBSCRIPTION:
        return '🔄';
      case NotificationCategory.ACCOUNT:
        return '👤';
      case NotificationCategory.SECURITY:
        return '🔒';
      case NotificationCategory.SYSTEM:
        return '⚙️';
      case NotificationCategory.MARKETING:
        return '📢';
      default:
        return '✉️';
    }
  }

  /**
   * Get priority styling for emails
   */
  private static getPriorityStyle(priority: NotificationPriority): { bgColor: string; textColor: string } {
    switch (priority) {
      case NotificationPriority.URGENT:
        return { bgColor: '#ff4444', textColor: '#ffffff' };
      case NotificationPriority.HIGH:
        return { bgColor: '#ff8800', textColor: '#ffffff' };
      case NotificationPriority.MEDIUM:
        return { bgColor: '#4A90E2', textColor: '#ffffff' };
      case NotificationPriority.LOW:
      default:
        return { bgColor: '#f8f9fa', textColor: '#333333' };
    }
  }
  
  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
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
   * Delete a notification
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId
      }
    });
  }

  /**
   * Get user's notifications
   */
  static async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      categories?: NotificationCategory[];
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      categories = []
    } = options;
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = { userId };
    
    if (unreadOnly) {
      where.read = false;
    }
    
    if (categories.length > 0) {
      where.data = {
        path: ['category'],
        in: categories
      };
    }
    
    // Get notifications
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);
    
    // Format notifications for display
    const formattedNotifications = notifications.map(notification => ({
      ...notification,
      timeAgo: formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }),
      priority: notification.data?.priority || NotificationPriority.MEDIUM,
      category: notification.data?.category || NotificationCategory.SYSTEM
    }));
    
    return {
      notifications: formattedNotifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount: unreadOnly ? total : await prisma.notification.count({
        where: { userId, read: false }
      })
    };
  }

  /**
   * Create a notification template
   */
  static async createTemplate(
    name: string,
    titleTemplate: string,
    bodyTemplate: string,
    category: NotificationCategory,
    organizationId?: string
  ) {
    return prisma.notificationTemplate.create({
      data: {
        name,
        titleTemplate,
        bodyTemplate,
        category,
        organizationId
      }
    });
  }

  /**
   * Mute notifications for a user
   */
  static async muteNotifications(userId: string, duration: number): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    // Set mute until time
    const mutedUntil = new Date();
    mutedUntil.setMinutes(mutedUntil.getMinutes() + duration);
    
    // Update preferences
    await this.updateUserPreferences(userId, {
      ...preferences,
      mutedUntil
    });
  }

  /**
   * Unmute notifications for a user
   */
  static async unmuteNotifications(userId: string): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    // Remove mute setting
    const updatedPreferences = { ...preferences };
    delete updatedPreferences.mutedUntil;
    
    await this.updateUserPreferences(userId, updatedPreferences);
  }

  /**
   * Set up Do Not Disturb schedule
   */
  static async setDoNotDisturb(
    userId: string,
    schedule: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timeZone: string;
      days: number[];
    }
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    await this.updateUserPreferences(userId, {
      ...preferences,
      doNotDisturb: schedule
    });
  }
} 