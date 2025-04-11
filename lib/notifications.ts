import { prisma } from '@/lib/prisma';
import { resend } from '@/lib/email';
import { Notification, NotificationType, NotificationChannel } from '@prisma/client';

interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  organizationId: string;
  userId?: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

export async function createNotification(options: NotificationOptions): Promise<Notification> {
  const {
    title,
    message,
    type,
    organizationId,
    userId,
    data,
    channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  } = options;

  const notification = await prisma.notification.create({
    data: {
      title,
      message,
      type,
      organizationId,
      userId,
      data: data as any,
      channels,
      read: false,
    },
    include: {
      organization: true,
      user: true,
    },
  });

  await Promise.all(
    channels.map(async (channel) => {
      switch (channel) {
        case NotificationChannel.EMAIL:
          await sendEmailNotification(notification);
          break;
        case NotificationChannel.SMS:
          if (process.env.TWILIO_ACCOUNT_SID) {
            await sendSmsNotification(notification);
          }
          break;
      }
    })
  );

  return notification;
}

async function sendEmailNotification(notification: Notification & { organization: any; user?: any }) {
  const { title, message, organization, user } = notification;
  const recipientEmail = user?.email || organization.email;
  
  if (!recipientEmail) {
    console.error('No recipient email found for notification', notification.id);
    return;
  }

  try {
    await resend.emails.send({
      from: `Billing Platform <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: title,
      html: `<div>
        <h1>${title}</h1>
        <p>${message}</p>
        <p>Log in to your account to view more details.</p>
      </div>`,
    });
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

async function sendSmsNotification(notification: Notification & { organization: any; user?: any }) {
  console.log('SMS notification would be sent here');
}

export async function sendPaymentFailedNotification(
  organizationId: string,
  invoiceId: string,
  amount: number,
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);

  return createNotification({
    title: 'Payment Failed',
    message: `Your payment of ${formattedAmount} could not be processed. Please update your payment method.`,
    type: NotificationType.PAYMENT_FAILED,
    organizationId,
    data: { invoiceId, amount },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

export async function sendSubscriptionRenewalReminder(
  organizationId: string,
  subscriptionId: string,
  renewalDate: Date,
  amount: number,
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(renewalDate);

  return createNotification({
    title: 'Subscription Renewal Reminder',
    message: `Your subscription will renew on ${formattedDate} for ${formattedAmount}.`,
    type: NotificationType.SUBSCRIPTION_RENEWAL,
    organizationId,
    data: { subscriptionId, renewalDate, amount },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

export async function sendUsageThresholdNotification(
  organizationId: string,
  usageType: string,
  currentUsage: number,
  threshold: number,
  limit: number,
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const percentUsed = Math.round((currentUsage / limit) * 100);

  return createNotification({
    title: 'Usage Threshold Alert',
    message: `You've used ${percentUsed}% of your ${usageType} limit. Current usage: ${currentUsage} of ${limit}.`,
    type: NotificationType.USAGE_THRESHOLD,
    organizationId,
    data: { usageType, currentUsage, threshold, limit, percentUsed },
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  });
}

interface NotificationPayload {
  type: string;
  userId: string;
  data: any;
  title?: string;
  message?: string;
}

export async function sendNotification(payload: NotificationPayload): Promise<Notification> {
  const { type, userId, data, title = '', message = '' } = payload;

  // Create notification in database
  const notification = await prisma.notification.create({
    data: {
      type,
      userId,
      data,
      title,
      message,
    },
  });

  // Send email notification if configured
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true') {
    await sendEmailNotification(notification);
  }

  // Send Slack notification if configured
  if (process.env.SLACK_NOTIFICATIONS_ENABLED === 'true') {
    await sendSlackNotification(notification);
  }

  return notification;
}

async function sendSlackNotification(notification: Notification) {
  // Implement Slack notification logic here
  // You can use the Slack Web API
  console.log('Sending Slack notification:', notification);
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<Notification> {
  return await prisma.notification.update({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      read: true,
    },
  });
}

export async function getUserNotifications(userId: string, options: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ notifications: Notification[]; total: number }> {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  const where = {
    userId,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total };
}