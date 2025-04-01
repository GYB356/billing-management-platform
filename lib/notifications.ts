import { prisma } from "./prisma";
import { Resend } from "resend";
import { createEvent, EventSeverity } from "./events";
import { sendSMS, isValidPhoneNumber } from "./notifications/sms";
import { sendPushNotification } from "./notifications/push";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Interface for creating a notification
interface CreateNotificationParams {
  userId?: string;
  organizationId?: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

// Notification channels
export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
}

// Interface for notification preferences
interface NotificationPreferences {
  types: {
    [key: string]: {
      channels: NotificationChannel[];
    };
  };
}

/**
 * Create a notification
 */
export async function createNotification({
  userId,
  organizationId,
  title,
  message,
  type,
  data = {},
  channels = [NotificationChannel.IN_APP],
}: CreateNotificationParams) {
  // Get user or organization details for delivery
  let userDetails = null;
  let organizationDetails = null;
  let recipientName = null;
  let userPreferences: NotificationPreferences | null = null;
  let organizationPreferences: NotificationPreferences | null = null;

  if (userId) {
    userDetails = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    recipientName = userDetails?.name || "User";
    userPreferences = userDetails?.metadata?.notificationPreferences as NotificationPreferences || null;
  }

  if (organizationId) {
    organizationDetails = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    recipientName = recipientName || organizationDetails?.name;
    organizationPreferences = organizationDetails?.settings?.notificationPreferences as NotificationPreferences || null;
  }

  // Apply notification preferences if available
  if (userPreferences?.types[type]) {
    channels = userPreferences.types[type].channels;
  } else if (organizationPreferences?.types[type]) {
    channels = organizationPreferences.types[type].channels;
  }

  // Always create in-app notification unless preferences explicitly exclude it
  if (!channels.includes(NotificationChannel.IN_APP) && 
      !channels.some(channel => channel === NotificationChannel.IN_APP)) {
    channels.push(NotificationChannel.IN_APP);
  }

  // Create the notification in the database
  const notification = await prisma.notification.create({
    data: {
      userId,
      organizationId,
      title,
      message,
      type,
      data: {
        ...data,
        deliveryChannels: channels,
      },
    },
    include: {
      user: true,
      organization: true,
    },
  });

  // Create an audit event
  const eventSeverity = type === "ERROR" ? EventSeverity.ERROR 
                      : type === "WARNING" ? EventSeverity.WARNING
                      : EventSeverity.INFO;
  
  await createEvent({
    userId,
    organizationId,
    eventType: "NOTIFICATION_CREATED",
    resourceType: "NOTIFICATION",
    resourceId: notification.id,
    severity: eventSeverity,
    metadata: {
      title,
      type,
      channels,
    },
  });

  // Deliver to each channel
  await Promise.allSettled(
    channels.map(async (channel) => {
      try {
        switch (channel) {
          case NotificationChannel.EMAIL:
            await deliverByEmail({
              notification,
              recipientName,
              userDetails,
              organizationDetails,
            });
            break;

          case NotificationChannel.SMS:
            await deliverBySms({
              notification,
              userDetails,
              organizationDetails,
            });
            break;

          case NotificationChannel.PUSH:
            await deliverByPush({
              notification,
              userDetails,
              organizationDetails,
            });
            break;
            
          // IN_APP is handled by the database creation above
        }
      } catch (error) {
        console.error(`Failed to deliver notification via ${channel}:`, error);
        
        // Log delivery failure
        await createEvent({
          userId,
          organizationId,
          eventType: "NOTIFICATION_DELIVERY_FAILED",
          resourceType: "NOTIFICATION",
          resourceId: notification.id,
          severity: EventSeverity.ERROR,
          metadata: {
            channel,
            error: (error as Error).message,
          },
        });
      }
    })
  );

  return notification;
}

/**
 * Deliver notification by email
 */
async function deliverByEmail({
  notification,
  recipientName,
  userDetails,
  organizationDetails,
}: {
  notification: any;
  recipientName?: string | null;
  userDetails?: any;
  organizationDetails?: any;
}) {
  let emailRecipient = null;

  if (userDetails?.email) {
    emailRecipient = userDetails.email;
  } else if (organizationDetails?.email) {
    emailRecipient = organizationDetails.email;
  }

  if (!emailRecipient) {
    throw new Error("No email recipient found");
  }

  // Get email subject based on notification type
  const getSubject = () => {
    switch (notification.type) {
      case "ERROR":
        return `⚠️ ${notification.title}`;
      case "WARNING":
        return `⚡ ${notification.title}`;
      case "SUCCESS":
        return `✅ ${notification.title}`;
      case "INFO":
      default:
        return `ℹ️ ${notification.title}`;
    }
  };

  const response = await resend.emails.send({
    from: `Billing Platform <${process.env.EMAIL_FROM}>`,
    to: [emailRecipient],
    subject: getSubject(),
    html: getEmailTemplate({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      recipientName,
      data: notification.data,
    }),
  });

  // Update notification with delivery status
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      data: {
        ...notification.data,
        emailDelivery: {
          status: "SENT",
          messageId: response.id,
          timestamp: new Date(),
        },
      },
    },
  });

  return response;
}

/**
 * Get email template
 */
function getEmailTemplate({
  title,
  message,
  type,
  recipientName,
  data = {},
}: {
  title: string;
  message: string;
  type: string;
  recipientName?: string | null;
  data?: Record<string, any>;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .notification {
          border-radius: 5px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .info { background-color: #e3f2fd; border-left: 4px solid #2196f3; }
        .success { background-color: #e8f5e9; border-left: 4px solid #4caf50; }
        .warning { background-color: #fff8e1; border-left: 4px solid #ffc107; }
        .error { background-color: #ffebee; border-left: 4px solid #f44336; }
        .title { margin-top: 0; margin-bottom: 10px; font-weight: bold; }
        .message { margin-bottom: 15px; }
        .footer {
          font-size: 12px;
          color: #666;
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #eee;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #4caf50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="notification ${type.toLowerCase()}">
        <h2 class="title">${title}</h2>
        <div class="message">${message}</div>
        ${recipientName ? `<p>Hello ${recipientName},</p>` : ''}
        <p>This is an automated notification from the Billing Platform.</p>
        ${data.actionUrl ? `<a href="${data.actionUrl}" class="button">${data.actionText || 'View Details'}</a>` : ''}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Billing Platform. All rights reserved.</p>
        <p>If you have any questions, please contact support@yourdomain.com</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Deliver notification by SMS
 */
async function deliverBySms({
  notification,
  userDetails,
  organizationDetails,
}: {
  notification: any;
  userDetails?: any;
  organizationDetails?: any;
}) {
  // Get phone number from user or organization
  let phoneNumber = null;

  if (userDetails?.phoneNumber) {
    phoneNumber = userDetails.phoneNumber;
  } else if (userDetails?.metadata?.phone) {
    phoneNumber = userDetails.metadata.phone;
  } else if (organizationDetails?.phone) {
    phoneNumber = organizationDetails.phone;
  } else if (organizationDetails?.settings?.contactPhone) {
    phoneNumber = organizationDetails.settings.contactPhone;
  }

  if (!phoneNumber) {
    throw new Error("No phone number found for SMS delivery");
  }

  // Validate phone number
  if (!isValidPhoneNumber(phoneNumber)) {
    throw new Error("Invalid phone number format for SMS delivery");
  }

  // Create a short message appropriate for SMS
  const smsMessage = createSmsContent({
    title: notification.title,
    message: notification.message,
    type: notification.type,
  });

  // Send SMS using Twilio
  const result = await sendSMS({
    to: phoneNumber,
    message: smsMessage,
    userId: notification.userId,
    organizationId: notification.organizationId,
    metadata: {
      notificationId: notification.id,
      notificationType: notification.type,
    },
  });

  // Update notification with delivery status
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      data: {
        ...notification.data,
        smsDelivery: {
          status: result.success ? "SENT" : "FAILED",
          messageId: result.messageId || null,
          error: result.error || null,
          timestamp: new Date(),
        },
      },
    },
  });

  return result;
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Ensure it starts with a country code
  if (!digits.startsWith('1')) {
    digits = '1' + digits; // Assume US/Canada if no country code
  }
  
  return '+' + digits;
}

/**
 * Create short SMS content
 */
function createSmsContent({
  title,
  message,
  type,
}: {
  title: string;
  message: string;
  type: string;
}): string {
  // Create appropriate prefix based on notification type
  let prefix = '';
  switch (type) {
    case 'ERROR':
      prefix = '🚨 ';
      break;
    case 'WARNING':
      prefix = '⚠️ ';
      break;
    case 'SUCCESS':
      prefix = '✅ ';
      break;
    case 'INFO':
    default:
      prefix = 'ℹ️ ';
      break;
  }
  
  // Truncate the message if needed (SMS typically has a 160 character limit)
  const maxLength = 140; // Leave room for the prefix and potential truncation indicator
  let smsMessage = `${prefix}${title}: ${message}`;
  
  if (smsMessage.length > maxLength) {
    smsMessage = smsMessage.substring(0, maxLength - 3) + '...';
  }
  
  return smsMessage;
}

/**
 * Deliver notification by push notification
 */
async function deliverByPush({
  notification,
  userDetails,
  organizationDetails,
}: {
  notification: any;
  userDetails?: any;
  organizationDetails?: any;
}) {
  // Extract user ID for push notification
  let userId = notification.userId;
  
  if (!userId) {
    throw new Error("No user ID found for push notification delivery");
  }

  // Create push notification content
  const pushTitle = notification.title;
  const pushBody = notification.message;
  
  // Add action data if available
  const pushData: Record<string, string> = {};
  
  if (notification.data.actionUrl) {
    pushData.url = notification.data.actionUrl;
  }
  
  if (notification.data.actionText) {
    pushData.actionText = notification.data.actionText;
  }
  
  // Add notification metadata
  pushData.notificationId = notification.id;
  pushData.type = notification.type;
  
  // Send push notification using Firebase
  const result = await sendPushNotification({
    userId,
    title: pushTitle,
    body: pushBody,
    data: pushData,
    organizationId: notification.organizationId,
    metadata: {
      notificationId: notification.id,
      notificationType: notification.type,
    },
  });

  // Update notification with delivery status
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      data: {
        ...notification.data,
        pushDelivery: {
          success: result.success,
          error: result.error || null,
          results: result.results || null,
          timestamp: new Date(),
        },
      },
    },
  });

  return result;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  
  // Create an audit event
  await createEvent({
    userId: notification.userId || undefined,
    organizationId: notification.organizationId || undefined,
    eventType: "NOTIFICATION_READ",
    resourceType: "NOTIFICATION",
    resourceId: notification.id,
    severity: EventSeverity.INFO,
  });
  
  return notification;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  
  // Create an audit event
  await createEvent({
    userId,
    eventType: "ALL_NOTIFICATIONS_READ",
    resourceType: "USER",
    resourceId: userId,
    severity: EventSeverity.INFO,
  });
  
  return true;
}

/**
 * Mark all notifications as read for an organization
 */
export async function markAllOrganizationNotificationsAsRead(organizationId: string) {
  await prisma.notification.updateMany({
    where: { organizationId, read: false },
    data: { read: true },
  });
  
  // Create an audit event
  await createEvent({
    organizationId,
    eventType: "ALL_NOTIFICATIONS_READ",
    resourceType: "ORGANIZATION",
    resourceId: organizationId,
    severity: EventSeverity.INFO,
  });
  
  return true;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  includeRead: boolean = false,
  limit: number = 20,
  offset: number = 0
) {
  const where = {
    userId,
    ...(includeRead ? {} : { read: false }),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const totalCount = await prisma.notification.count({ where });
  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });

  return {
    notifications,
    totalCount,
    unreadCount,
  };
}

/**
 * Get notifications for an organization
 */
export async function getOrganizationNotifications(
  organizationId: string,
  includeRead: boolean = false,
  limit: number = 20,
  offset: number = 0
) {
  const where = {
    organizationId,
    ...(includeRead ? {} : { read: false }),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const totalCount = await prisma.notification.count({ where });
  const unreadCount = await prisma.notification.count({
    where: { organizationId, read: false },
  });

  return {
    notifications,
    totalCount,
    unreadCount,
  };
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Update user metadata with notification preferences
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: {
        ...(user.metadata as any || {}),
        notificationPreferences: preferences,
      },
    },
  });

  // Create an audit event
  await createEvent({
    userId,
    eventType: "NOTIFICATION_PREFERENCES_UPDATED",
    resourceType: "USER",
    resourceId: userId,
    severity: EventSeverity.INFO,
    metadata: {
      preferences,
    },
  });

  return updatedUser;
}

/**
 * Update organization notification preferences
 */
export async function updateOrganizationNotificationPreferences(
  organizationId: string,
  preferences: NotificationPreferences
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  // Update organization settings with notification preferences
  const updatedOrganization = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...(organization.settings as any || {}),
        notificationPreferences: preferences,
      },
    },
  });

  // Create an audit event
  await createEvent({
    organizationId,
    eventType: "NOTIFICATION_PREFERENCES_UPDATED",
    resourceType: "ORGANIZATION",
    resourceId: organizationId,
    severity: EventSeverity.INFO,
    metadata: {
      preferences,
    },
  });

  return updatedOrganization;
} 