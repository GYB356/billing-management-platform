import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/metrics/route';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

describe('Metrics API Endpoints', () => {
  // Test data
  const testOrg = {
    id: crypto.randomUUID(),
    name: 'Test Org',
    email: 'test@example.com',
  };

  const testUser = {
    id: crypto.randomUUID(),
    name: 'Test User',
    email: 'user@example.com',
  };

  const testWebhook = {
    id: crypto.randomUUID(),
    url: 'https://example.com/webhook',
    organizationId: testOrg.id,
    status: 'ACTIVE',
    secret: 'test-secret',
  };

  // Setup and teardown
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Clear database
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhook.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();

    // Create test organization
    await prisma.organization.create({
      data: testOrg,
    });

    // Create test webhook
    await prisma.webhook.create({
      data: testWebhook,
    });

    // Mock authenticated session
    (getServerSession as jest.Mock).mockResolvedValue({
      user: testUser,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/metrics', () => {
    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req } = createMocks({
        method: 'GET',
        query: { organizationId: testOrg.id },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('should return 400 if organizationId is missing', async () => {
      const { req } = createMocks({
        method: 'GET',
      });

      const response = await GET(req);
      expect(response.status).toBe(400);
    });

    it('should return metrics for organization', async () => {
      // Create test webhook deliveries
      await Promise.all([
        prisma.webhookDelivery.create({
          data: {
            webhookId: testWebhook.id,
            status: 'COMPLETED',
            statusCode: 200,
            payload: {},
          },
        }),
        prisma.webhookDelivery.create({
          data: {
            webhookId: testWebhook.id,
            status: 'FAILED',
            statusCode: 500,
            payload: {},
            error: 'Test error',
          },
        }),
      ]);

      // Create test events
      await Promise.all([
        prisma.event.create({
          data: {
            organizationId: testOrg.id,
            eventType: 'TEST_EVENT',
            severity: 'INFO',
            resourceType: 'test',
            resourceId: 'test-1',
          },
        }),
        prisma.event.create({
          data: {
            organizationId: testOrg.id,
            eventType: 'TEST_EVENT',
            severity: 'ERROR',
            resourceType: 'test',
            resourceId: 'test-2',
          },
        }),
      ]);

      const { req } = createMocks({
        method: 'GET',
        query: { 
          organizationId: testOrg.id,
          interval: 'day',
        },
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        webhookStats: {
          total: 2,
          successRate: 50,
          byStatus: expect.arrayContaining([
            expect.objectContaining({ status: 'COMPLETED', _count: 1 }),
            expect.objectContaining({ status: 'FAILED', _count: 1 }),
          ]),
        },
        eventStats: {
          byType: expect.arrayContaining([
            expect.objectContaining({ eventType: 'TEST_EVENT', severity: 'INFO', _count: 1 }),
            expect.objectContaining({ eventType: 'TEST_EVENT', severity: 'ERROR', _count: 1 }),
          ]),
        },
        timeSeries: expect.any(Array),
        topFailingWebhooks: expect.arrayContaining([
          expect.objectContaining({
            id: testWebhook.id,
            url: testWebhook.url,
            _count: expect.objectContaining({
              deliveries: 1,
            }),
          }),
        ]),
      });
    });
  });

  describe('POST /api/metrics/export', () => {
    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req } = createMocks({
        method: 'POST',
        body: { organizationId: testOrg.id },
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should export metrics as CSV', async () => {
      // Create test webhook deliveries
      await Promise.all([
        prisma.webhookDelivery.create({
          data: {
            webhookId: testWebhook.id,
            status: 'COMPLETED',
            statusCode: 200,
            payload: {},
          },
        }),
        prisma.webhookDelivery.create({
          data: {
            webhookId: testWebhook.id,
            status: 'FAILED',
            statusCode: 500,
            payload: {},
            error: 'Test error',
          },
        }),
      ]);

      const { req } = createMocks({
        method: 'POST',
        body: {
          organizationId: testOrg.id,
          format: 'csv',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="webhook-metrics-.*\.csv"$/);

      const csv = await response.text();
      expect(csv).toContain('id,webhookUrl,status,statusCode,createdAt,retries,error');
      expect(csv.split('\n').length).toBe(3); // Header + 2 rows
    });
  });
}); 