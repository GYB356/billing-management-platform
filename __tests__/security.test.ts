import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { logSecurityEvent, SecurityEventType } from '@/lib/security/logging';
import { checkAndSendAlerts } from '@/lib/security/alerts';
import { generateDailyReport } from '@/lib/security/reports';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  })),
}));

describe('Security Tests', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Security Event Logging', () => {
    it('should log security events correctly', async () => {
      const eventData = {
        userId: 'test-user-id',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        eventType: SecurityEventType.LOGIN_FAILURE,
        details: { reason: 'Invalid credentials' },
        severity: 'HIGH' as const,
      };

      await logSecurityEvent(eventData);
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: eventData.userId,
          ipAddress: eventData.ipAddress,
          eventType: eventData.eventType,
        }),
      });
    });
  });

  describe('Security Alerts', () => {
    it('should check and send alerts for suspicious activity', async () => {
      const mockReq = {
        ip: '127.0.0.1',
        headers: new Map([
          ['user-agent', 'test-agent'],
          ['x-forwarded-for', '127.0.0.1'],
        ]),
        nextUrl: {
          pathname: '/api/auth/login',
        },
        method: 'POST',
        body: { email: 'test@example.com', password: 'wrong-password' },
      } as unknown as NextRequest;

      await checkAndSendAlerts(mockReq);
      expect(prisma.securityEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('Security Reports', () => {
    it('should generate daily security reports', async () => {
      const report = await generateDailyReport();
      expect(report).toBeDefined();
      expect(prisma.securityEvent.findMany).toHaveBeenCalled();
    });
  });
}); 