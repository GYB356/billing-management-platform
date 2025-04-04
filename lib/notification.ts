import { prisma } from './prisma';
import { Resend } from 'resend';
import { Organization, User } from '@prisma/client';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  static async createInAppNotification(
    userId: string,
    data: NotificationData
  ) {
    return prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        metadata: data.metadata,
        read: false,
      },
    });
  }

  static async createEmailNotification(
    user: User,
    organization: Organization,
    data: NotificationData
  ) {
    // Create in-app notification
    await this.createInAppNotification(user.id, data);

    // Send email notification
    if (user.email) {
      await resend.emails.send({
        from: 'Billing Platform <notifications@billingplatform.com>',
        to: user.email,
        subject: data.title,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${data.title}</h2>
            <p style="color: #666;">${data.message}</p>
            ${data.link ? `<p><a href="${data.link}" style="color: #007bff; text-decoration: none;">View Details</a></p>` : ''}
          </div>
        `,
      });
    }
  }

  static async markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  static async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  static async getUserNotifications(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  static async deleteNotification(notificationId: string) {
    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  // Helper methods for common notification types
  static async notifyInvoiceGenerated(
    user: User,
    organization: Organization,
    invoiceId: string,
    amount: number
  ) {
    await this.createEmailNotification(user, organization, {
      title: 'New Invoice Generated',
      message: `A new invoice for ${amount} has been generated for your organization.`,
      type: 'info',
      link: `/invoices/${invoiceId}`,
      metadata: { invoiceId, amount },
    });
  }

  static async notifyPaymentReceived(
    user: User,
    organization: Organization,
    invoiceId: string,
    amount: number
  ) {
    await this.createEmailNotification(user, organization, {
      title: 'Payment Received',
      message: `Payment of ${amount} has been received for invoice #${invoiceId}.`,
      type: 'success',
      link: `/invoices/${invoiceId}`,
      metadata: { invoiceId, amount },
    });
  }

  static async notifyPaymentFailed(
    user: User,
    organization: Organization,
    invoiceId: string,
    amount: number
  ) {
    await this.createEmailNotification(user, organization, {
      title: 'Payment Failed',
      message: `Payment of ${amount} for invoice #${invoiceId} has failed. Please update your payment method.`,
      type: 'error',
      link: `/invoices/${invoiceId}`,
      metadata: { invoiceId, amount },
    });
  }

  static async notifySubscriptionExpiring(
    user: User,
    organization: Organization,
    daysUntilExpiry: number
  ) {
    await this.createEmailNotification(user, organization, {
      title: 'Subscription Expiring Soon',
      message: `Your subscription will expire in ${daysUntilExpiry} days. Please renew to continue using our services.`,
      type: 'warning',
      link: '/subscription',
      metadata: { daysUntilExpiry },
    });
  }

  static async notifyUsageLimitReached(
    user: User,
    organization: Organization,
    usageType: string,
    currentUsage: number,
    limit: number
  ) {
    await this.createEmailNotification(user, organization, {
      title: 'Usage Limit Reached',
      message: `You have reached your ${usageType} usage limit (${currentUsage}/${limit}). Please upgrade your plan for additional capacity.`,
      type: 'warning',
      link: '/subscription',
      metadata: { usageType, currentUsage, limit },
    });
  }
} 