import { prisma } from '@/lib/prisma';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  private constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.delete({
      where: {
        userId_endpoint: {
          userId,
          endpoint,
        },
      },
    });
  }

  async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      message: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
    }
  ): Promise<void> {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.warn('VAPID keys not configured. Skipping push notification.');
      return;
    }

    const webPush = require('web-push');
    webPush.setVapidDetails(
      process.env.NEXT_PUBLIC_APP_URL || 'https://example.com',
      this.vapidPublicKey,
      this.vapidPrivateKey
    );

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.message,
            icon: notification.icon || '/notification-icon.png',
            badge: notification.badge || '/notification-badge.png',
            tag: notification.tag,
            data: notification.data,
          })
        );
      } catch (error) {
        if ((error as any).statusCode === 410) {
          // Subscription has expired or is no longer valid
          await this.removeSubscription(userId, subscription.endpoint);
        } else {
          console.error('Error sending push notification:', error);
        }
      }
    });

    await Promise.all(sendPromises);
  }

  async getUserSubscriptions(userId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId },
    });
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();