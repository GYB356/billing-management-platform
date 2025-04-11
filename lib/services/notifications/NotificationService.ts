import { prisma } from '@/lib/prisma';
import { emailService } from './EmailService';
import { webhookService } from '../webhooks/WebhookService';
import { Notification, NotificationChannel, NotificationTemplate } from './types';

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async sendNotification(notification: Notification) {
    const { channel } = notification;
    await this.deliverNotification(channel, notification);
  }

  private async deliverNotification(
    channel: NotificationChannel,
    notification: Notification
  ) {
    const template = await this.getTemplate(notification.type, channel);
    const renderedTemplate = this.renderTemplate(template, notification.data);

    switch (channel) {
      case 'email':
        await emailService.sendEmail(notification.recipient, renderedTemplate);
        break;
      case 'webhook':
        await webhookService.sendWebhook(notification.recipient, renderedTemplate);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }
  }

  private async getTemplate(
    type: string,
    channel: NotificationChannel
  ): Promise<NotificationTemplate> {
    const template = await prisma.notificationTemplate.findFirst({
      where: { type, channel },
    });

    if (!template) {
      throw new Error(`Template not found for type: ${type} and channel: ${channel}`);
    }

    return template;
  }

  private renderTemplate(template: NotificationTemplate, data: any) {
    return template.content.replace(/\{\{(.*?)\}\}/g, (_, key) => data[key.trim()] || '');
  }
}

export const notificationService = NotificationService.getInstance();