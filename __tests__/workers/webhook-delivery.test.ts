import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deliverWebhook, processPendingDeliveries } from '@/lib/workers/webhook-delivery';
import crypto from 'crypto';

// Mock fetch
global.fetch = vi.fn();

describe('Webhook Delivery Worker', () => {
  // Test data
  const testWebhook = {
    id: crypto.randomUUID(),
    url: 'https://example.com/webhook',
    secret: 'test-secret',
    status: 'ACTIVE',
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
  };

  const testDelivery = {
    id: crypto.randomUUID(),
    webhookId: testWebhook.id,
    payload: { event: 'test.event', data: { foo: 'bar' } },
    status: 'PENDING',
    retries: 0,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Clear database
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhook.deleteMany();

    // Create test webhook
    await prisma.webhook.create({
      data: testWebhook,
    });

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('deliverWebhook', () => {
    it('should successfully deliver webhook on first attempt', async () => {
      // Create test delivery
      const delivery = await prisma.webhookDelivery.create({
        data: testDelivery,
      });

      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      // Deliver webhook
      await deliverWebhook(delivery.id);

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        testWebhook.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-ID': testWebhook.id,
            'X-Delivery-ID': delivery.id,
          }),
          body: JSON.stringify(testDelivery.payload),
        })
      );

      // Verify delivery was updated
      const updatedDelivery = await prisma.webhookDelivery.findUnique({
        where: { id: delivery.id },
      });
      expect(updatedDelivery).toMatchObject({
        status: 'COMPLETED',
        statusCode: 200,
        response: 'OK',
      });

      // Verify webhook was updated
      const updatedWebhook = await prisma.webhook.findUnique({
        where: { id: testWebhook.id },
      });
      expect(updatedWebhook?.lastSuccess).toBeDefined();
    });

    it('should retry failed deliveries with backoff', async () => {
      // Create test delivery
      const delivery = await prisma.webhookDelivery.create({
        data: testDelivery,
      });

      // Mock failed responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('OK'),
        });

      // Deliver webhook
      await deliverWebhook(delivery.id);

      // Verify first attempt failed
      let updatedDelivery = await prisma.webhookDelivery.findUnique({
        where: { id: delivery.id },
      });
      expect(updatedDelivery).toMatchObject({
        status: 'PENDING',
        retries: 1,
        statusCode: 500,
      });

      // Deliver again
      await deliverWebhook(delivery.id);

      // Verify second attempt failed
      updatedDelivery = await prisma.webhookDelivery.findUnique({
        where: { id: delivery.id },
      });
      expect(updatedDelivery).toMatchObject({
        status: 'PENDING',
        retries: 2,
        statusCode: 500,
      });

      // Deliver final time
      await deliverWebhook(delivery.id);

      // Verify final attempt succeeded
      updatedDelivery = await prisma.webhookDelivery.findUnique({
        where: { id: delivery.id },
      });
      expect(updatedDelivery).toMatchObject({
        status: 'COMPLETED',
        retries: 2,
        statusCode: 200,
      });
    });

    it('should mark delivery as failed after max retries', async () => {
      // Create test delivery
      const delivery = await prisma.webhookDelivery.create({
        data: testDelivery,
      });

      // Mock failed responses
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      // Attempt delivery max times
      for (let i = 0; i <= testWebhook.retryConfig.maxAttempts; i++) {
        await deliverWebhook(delivery.id);
      }

      // Verify delivery was marked as failed
      const updatedDelivery = await prisma.webhookDelivery.findUnique({
        where: { id: delivery.id },
      });
      expect(updatedDelivery).toMatchObject({
        status: 'FAILED',
        retries: testWebhook.retryConfig.maxAttempts,
      });

      // Verify webhook last failure was updated
      const updatedWebhook = await prisma.webhook.findUnique({
        where: { id: testWebhook.id },
      });
      expect(updatedWebhook?.lastFailure).toBeDefined();
    });
  });

  describe('processPendingDeliveries', () => {
    it('should process multiple pending deliveries concurrently', async () => {
      // Create multiple test deliveries
      const deliveries = await Promise.all(
        Array.from({ length: 5 }).map(() =>
          prisma.webhookDelivery.create({
            data: testDelivery,
          })
        )
      );

      // Mock successful responses
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      // Process pending deliveries
      await processPendingDeliveries();

      // Verify all deliveries were processed
      const updatedDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          id: {
            in: deliveries.map(d => d.id),
          },
        },
      });

      expect(updatedDeliveries).toHaveLength(deliveries.length);
      updatedDeliveries.forEach(delivery => {
        expect(delivery).toMatchObject({
          status: 'COMPLETED',
          statusCode: 200,
        });
      });
    });
  });
}); 