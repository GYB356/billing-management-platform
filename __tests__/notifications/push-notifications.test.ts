import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { pushNotificationService } from '@/lib/push-notification-service';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

jest.mock('@/lib/prisma');
jest.mock('web-push');

describe('Push Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Subscription Management', () => {
    it('should save a new push subscription', async () => {
      const mockSubscription = {
        userId: 'user-1',
        endpoint: 'https://push.example.com/123',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      (prisma.pushSubscription.upsert as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        ...mockSubscription,
      });

      await pushNotificationService.saveSubscription(
        mockSubscription.userId,
        mockSubscription
      );

      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: {
          userId_endpoint: {
            userId: mockSubscription.userId,
            endpoint: mockSubscription.endpoint,
          },
        },
        update: {
          p256dh: mockSubscription.keys.p256dh,
          auth: mockSubscription.keys.auth,
        },
        create: {
          userId: mockSubscription.userId,
          endpoint: mockSubscription.endpoint,
          p256dh: mockSubscription.keys.p256dh,
          auth: mockSubscription.keys.auth,
        },
      });
    });

    it('should remove an existing push subscription', async () => {
      const userId = 'user-1';
      const endpoint = 'https://push.example.com/123';

      (prisma.pushSubscription.delete as jest.Mock).mockResolvedValue({});

      await pushNotificationService.removeSubscription(userId, endpoint);

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: {
          userId_endpoint: {
            userId,
            endpoint,
          },
        },
      });
    });
  });

  describe('Push Notification Sending', () => {
    it('should send push notifications to all user subscriptions', async () => {
      const userId = 'user-1';
      const notification = {
        title: 'Test Notification',
        message: 'This is a test push notification',
        data: { url: '/test' },
      };

      const mockSubscriptions = [
        {
          endpoint: 'https://push.example.com/123',
          p256dh: 'p256dh-1',
          auth: 'auth-1',
        },
        {
          endpoint: 'https://push.example.com/456',
          p256dh: 'p256dh-2',
          auth: 'auth-2',
        },
      ];

      (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue(
        mockSubscriptions
      );

      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await pushNotificationService.sendPushNotification(userId, notification);

      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      mockSubscriptions.forEach((subscription, index) => {
        expect(webpush.sendNotification).toHaveBeenNthCalledWith(
          index + 1,
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          expect.any(String)
        );
      });
    });

    it('should handle expired subscriptions by removing them', async () => {
      const userId = 'user-1';
      const notification = {
        title: 'Test Notification',
        message: 'This is a test notification',
      };

      const mockSubscriptions = [
        {
          endpoint: 'https://push.example.com/expired',
          p256dh: 'p256dh-1',
          auth: 'auth-1',
        },
      ];

      (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue(
        mockSubscriptions
      );

      const expiredError = new Error('Subscription expired');
      (expiredError as any).statusCode = 410;
      (webpush.sendNotification as jest.Mock).mockRejectedValue(expiredError);

      await pushNotificationService.sendPushNotification(userId, notification);

      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: {
          userId_endpoint: {
            userId,
            endpoint: mockSubscriptions[0].endpoint,
          },
        },
      });
    });
  });

  describe('Configuration', () => {
    it('should return VAPID public key', () => {
      const vapidPublicKey = pushNotificationService.getVapidPublicKey();
      expect(typeof vapidPublicKey).toBe('string');
    });
  });
});