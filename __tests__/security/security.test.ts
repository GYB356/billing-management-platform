import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SecurityEventType } from '../../lib/security/types';
import { logSecurityEvent, getSecurityEvents, generateDailySecurityReport } from '../../lib/security/logging';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      securityEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $disconnect: jest.fn(),
    })),
  };
});

describe('Security Module', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe('logSecurityEvent', () => {
    it('should log security events correctly', async () => {
      const mockReq = {
        headers: new Map([
          ['x-forwarded-for', '127.0.0.1'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '127.0.0.1',
      } as unknown as NextRequest;

      await logSecurityEvent(
        SecurityEventType.LOGIN_FAILURE,
        mockReq,
        'user123',
        { reason: 'Invalid password' }
      );

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          type: SecurityEventType.LOGIN_FAILURE,
          timestamp: expect.any(Date),
          userId: 'user123',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: { reason: 'Invalid password' },
        },
      });
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve security events within a date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      const mockEvents = [
        {
          id: '1',
          type: SecurityEventType.LOGIN_FAILURE,
          timestamp: new Date('2024-01-01T12:00:00Z'),
          userId: 'user123',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: { reason: 'Invalid password' },
        },
      ];

      mockPrisma.securityEvent.findMany.mockResolvedValue(mockEvents);

      const events = await getSecurityEvents(startDate, endDate);

      expect(mockPrisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
      expect(events).toEqual(mockEvents);
    });
  });

  describe('generateDailySecurityReport', () => {
    it('should generate a daily security report', async () => {
      const mockEvents = [
        {
          id: '1',
          type: SecurityEventType.LOGIN_FAILURE,
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
        },
        {
          id: '2',
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
        },
      ];

      mockPrisma.securityEvent.findMany.mockResolvedValue(mockEvents);

      const report = await generateDailySecurityReport();

      expect(report).toBeDefined();
      expect(report.totalEvents).toBe(2);
      expect(report.eventsByType[SecurityEventType.LOGIN_FAILURE]).toBe(1);
      expect(report.eventsByType[SecurityEventType.SUSPICIOUS_ACTIVITY]).toBe(1);
      expect(report.suspiciousIPs).toContain('127.0.0.1');
    });
  });
}); 