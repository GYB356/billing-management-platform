import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SecurityEventType } from '../../lib/security/types';
import { logSecurityEvent } from '../../lib/security/logging';
import { checkAndSendAlerts } from '../../lib/security/alerts';
import { createMocks } from 'node-mocks-http';
import { generateDailyReport } from '@/lib/security/reports';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      securityEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      securityAlert: {
        create: jest.fn(),
      },
      $disconnect: jest.fn(),
    })),
  };
});

describe('Security Penetration Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe('Rate Limiting', () => {
    it('should detect and log rate limit violations', async () => {
      const mockReq = {
        headers: new Map([
          ['x-forwarded-for', '127.0.0.1'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '127.0.0.1',
      } as unknown as NextRequest;

      // Simulate multiple rapid requests
      for (let i = 0; i < 10; i++) {
        await logSecurityEvent(
          SecurityEventType.RATE_LIMIT_EXCEEDED,
          mockReq,
          'user123',
          { endpoint: '/api/test' }
        );
      }

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledTimes(10);
      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          }),
        })
      );
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect and alert on suspicious patterns', async () => {
      const mockReq = {
        headers: new Map([
          ['x-forwarded-for', '127.0.0.1'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '127.0.0.1',
      } as unknown as NextRequest;

      // Mock finding multiple security events
      mockPrisma.securityEvent.findMany.mockResolvedValue(Array(6).fill({
        type: SecurityEventType.LOGIN_FAILURE,
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
      }));

      await checkAndSendAlerts(mockReq);

      expect(mockPrisma.securityAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: SecurityEventType.LOGIN_FAILURE,
            severity: 'HIGH',
          }),
        })
      );
    });
  });

  describe('Input Validation', () => {
    it('should log attempts at SQL injection', async () => {
      const mockReq = {
        headers: new Map([
          ['x-forwarded-for', '127.0.0.1'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '127.0.0.1',
      } as unknown as NextRequest;

      await logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        mockReq,
        'user123',
        {
          input: "' OR '1'='1",
          type: 'SQL_INJECTION_ATTEMPT',
        }
      );

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: SecurityEventType.SUSPICIOUS_ACTIVITY,
            details: expect.objectContaining({
              type: 'SQL_INJECTION_ATTEMPT',
            }),
          }),
        })
      );
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle malicious SQL input safely', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/auth/signin',
        body: {
          email: "' OR '1'='1",
          password: "' OR '1'='1",
        },
      });

      const mockRequest = new NextRequest(req.url, {
        method: req.method,
        body: JSON.stringify(req.body),
      });

      await checkAndSendAlerts(mockRequest);

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          details: expect.objectContaining({
            reason: expect.stringContaining('SQL injection attempt'),
          }),
        }),
      });
    });
  });

  describe('XSS Prevention', () => {
    it('should handle malicious script input safely', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/auth/signin',
        body: {
          email: '<script>alert("xss")</script>',
          password: '<script>alert("xss")</script>',
        },
      });

      const mockRequest = new NextRequest(req.url, {
        method: req.method,
        body: JSON.stringify(req.body),
      });

      await checkAndSendAlerts(mockRequest);

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          details: expect.objectContaining({
            reason: expect.stringContaining('XSS attempt'),
          }),
        }),
      });
    });
  });

  describe('Authorization Tests', () => {
    it('should prevent unauthorized access to admin endpoints', async () => {
      const mockReq = createMocks({
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      const response = await logSecurityEvent({
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: { attempt: 1, type: 'UNAUTHORIZED_ACCESS' },
        severity: 'HIGH',
      });

      const events = await mockPrisma.securityEvent.findMany({
        where: {
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          details: { path: ['type'], equals: 'UNAUTHORIZED_ACCESS' },
        },
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].severity).toBe('HIGH');
    });
  });

  describe('Alert System Tests', () => {
    it('should generate alerts for suspicious activities', async () => {
      const suspiciousEvent = {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: { reason: 'Test suspicious activity' },
        severity: 'HIGH' as const,
      };

      await logSecurityEvent(suspiciousEvent);
      await checkAndSendAlerts(suspiciousEvent);

      const events = await mockPrisma.securityEvent.findMany({
        where: {
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          ipAddress: '127.0.0.1',
        },
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].details).toHaveProperty('reason', 'Test suspicious activity');
    });
  });

  describe('Report Generation Tests', () => {
    it('should generate accurate security reports', async () => {
      const report = await generateDailyReport();

      expect(report).toHaveProperty('period', 'Daily');
      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('eventsByType');
      expect(report).toHaveProperty('eventsBySeverity');
      expect(report).toHaveProperty('suspiciousActivities');
      expect(report).toHaveProperty('uniqueIPs');
      expect(report).toHaveProperty('uniqueUsers');
      expect(report).toHaveProperty('criticalEvents');
    });
  });
}); 