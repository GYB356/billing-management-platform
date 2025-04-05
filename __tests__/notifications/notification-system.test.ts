import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';
import { usageMonitoringService } from '@/lib/usage-monitoring';

// Mock external dependencies
jest.mock('@/lib/prisma');
jest.mock('@/lib/email');

describe('Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Service', () => {
    it('should send notifications through specified channels', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      const mockPreferences = {
        email: true,
        inApp: true,
        push: false,
      };

      // Mock database calls
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreferences);
      (prisma.notification.create as jest.Mock).mockResolvedValue({ id: 'notification-1' });

      await notificationService.send({
        userId: 'user-1',
        type: 'BILLING',
        title: 'Test Notification',
        message: 'This is a test notification',
      });

      // Verify notification was created
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'BILLING',
            title: 'Test Notification',
            message: 'This is a test notification',
          }),
        })
      );
    });

    it('should respect user notification preferences', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      const mockPreferences = {
        email: false,
        inApp: true,
        push: false,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreferences);
      (prisma.notification.create as jest.Mock).mockResolvedValue({ id: 'notification-1' });

      await notificationService.send({
        userId: 'user-1',
        type: 'SYSTEM',
        title: 'Test Notification',
        message: 'This is a test notification',
        channels: ['email', 'inApp'],
      });

      // Verify only in-app notification was created
      expect(prisma.notification.create).toHaveBeenCalled();
      // Verify email was not sent
      expect(jest.mocked(require('@/lib/email').sendEmail)).not.toHaveBeenCalled();
    });
  });

  describe('Usage Monitoring', () => {
    it('should detect when usage thresholds are reached', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-1',
        plan: {
          features: [
            {
              id: 'feature-1',
              name: 'API Calls',
              usageLimit: 1000,
            },
          ],
        },
        usageRecords: [
          {
            featureId: 'feature-1',
            quantity: 800, // 80% usage
          },
        ],
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.usageNotification.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usageNotification.create as jest.Mock).mockResolvedValue({ id: 'usage-notification-1' });

      await usageMonitoringService.checkUsageThresholds('sub-1');

      // Verify usage notification was created
      expect(prisma.usageNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionId: 'sub-1',
            featureId: 'feature-1',
          }),
        })
      );
    });

    it('should not create duplicate notifications for the same threshold', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-1',
        plan: {
          features: [
            {
              id: 'feature-1',
              name: 'API Calls',
              usageLimit: 1000,
            },
          ],
        },
        usageRecords: [
          {
            featureId: 'feature-1',
            quantity: 800,
          },
        ],
      };

      const mockExistingNotification = {
        id: 'usage-notification-1',
        subscriptionId: 'sub-1',
        featureId: 'feature-1',
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.usageNotification.findUnique as jest.Mock).mockResolvedValue(mockExistingNotification);

      await usageMonitoringService.checkUsageThresholds('sub-1');

      // Verify no new notification was created
      expect(prisma.usageNotification.create).not.toHaveBeenCalled();
    });
  });

  describe('Notification Preferences', () => {
    it('should update user notification preferences', async () => {
      const mockPreferences = {
        id: 'pref-1',
        userId: 'user-1',
        type: 'BILLING',
        email: true,
        inApp: true,
        push: false,
      };

      (prisma.notificationPreference.upsert as jest.Mock).mockResolvedValue(mockPreferences);

      const updatedPreferences = await notificationService.updatePreferences('user-1', 'BILLING', {
        email: false,
        inApp: true,
        push: true,
      });

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_type: {
              userId: 'user-1',
              type: 'BILLING',
            },
          },
          update: {
            email: false,
            inApp: true,
            push: true,
          },
        })
      );
    });
  });
});