import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createMocks } from 'node-mocks-http';
import { GET, POST, PATCH, DELETE } from '@/app/api/webhooks/route';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

describe('Webhook API Endpoints', () => {
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
    url: 'https://example.com/webhook',
    events: ['payment.succeeded', 'subscription.created'],
    description: 'Test webhook',
  };

  // Setup and teardown
  beforeEach(async () => {
    // Clear database
    await prisma.webhook.deleteMany();
    await prisma.organization.deleteMany();

    // Create test organization
    await prisma.organization.create({
      data: testOrg,
    });

    // Mock authenticated session
    (getServerSession as jest.Mock).mockResolvedValue({
      user: testUser,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/webhooks', () => {
    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req, res } = createMocks({
        method: 'GET',
        query: { organizationId: testOrg.id },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('should return 400 if organizationId is missing', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      });

      const response = await GET(req);
      expect(response.status).toBe(400);
    });

    it('should return empty array when no webhooks exist', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { organizationId: testOrg.id },
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return list of webhooks', async () => {
      // Create test webhook
      const webhook = await prisma.webhook.create({
        data: {
          ...testWebhook,
          organization: { connect: { id: testOrg.id } },
          status: 'ACTIVE',
          secret: 'test-secret',
          retryConfig: {},
        },
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { organizationId: testOrg.id },
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        url: testWebhook.url,
        events: testWebhook.events,
      });
    });
  });

  describe('POST /api/webhooks', () => {
    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req, res } = createMocks({
        method: 'POST',
        body: testWebhook,
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should return 400 if request data is invalid', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          ...testWebhook,
          url: 'invalid-url',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should create webhook successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          ...testWebhook,
          organizationId: testOrg.id,
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        url: testWebhook.url,
        events: testWebhook.events,
        status: 'ACTIVE',
      });
      expect(data.secret).toBeDefined();
    });
  });

  describe('PATCH /api/webhooks/[id]', () => {
    let webhook;

    beforeEach(async () => {
      webhook = await prisma.webhook.create({
        data: {
          ...testWebhook,
          organization: { connect: { id: testOrg.id } },
          status: 'ACTIVE',
          secret: 'test-secret',
          retryConfig: {},
        },
      });
    });

    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req, res } = createMocks({
        method: 'PATCH',
        params: { id: webhook.id },
        body: { status: 'INACTIVE' },
      });

      const response = await PATCH(req, { params: { id: webhook.id } });
      expect(response.status).toBe(401);
    });

    it('should update webhook successfully', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        params: { id: webhook.id },
        body: { status: 'INACTIVE' },
      });

      const response = await PATCH(req, { params: { id: webhook.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: webhook.id,
        status: 'INACTIVE',
      });
    });
  });

  describe('DELETE /api/webhooks/[id]', () => {
    let webhook;

    beforeEach(async () => {
      webhook = await prisma.webhook.create({
        data: {
          ...testWebhook,
          organization: { connect: { id: testOrg.id } },
          status: 'ACTIVE',
          secret: 'test-secret',
          retryConfig: {},
        },
      });
    });

    it('should return 401 if not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { req, res } = createMocks({
        method: 'DELETE',
        params: { id: webhook.id },
      });

      const response = await DELETE(req, { params: { id: webhook.id } });
      expect(response.status).toBe(401);
    });

    it('should delete webhook successfully', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        params: { id: webhook.id },
      });

      const response = await DELETE(req, { params: { id: webhook.id } });
      expect(response.status).toBe(204);

      // Verify webhook was deleted
      const deletedWebhook = await prisma.webhook.findUnique({
        where: { id: webhook.id },
      });
      expect(deletedWebhook).toBeNull();
    });
  });
}); 