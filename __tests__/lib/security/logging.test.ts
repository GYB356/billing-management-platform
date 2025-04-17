import { logSecurityEvent, SecurityEventType, SecurityEventSeverity } from '@/lib/security/logging';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback()),
    $disconnect: jest.fn(),
  })),
}));

describe('Security Logging', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe('logSecurityEvent', () => {
    const mockEvent = {
      type: SecurityEventType.LOGIN_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      userId: 'user_123',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      metadata: {
        sessionId: 'session_123',
        location: 'US',
      },
    };

    it('should successfully log a security event', async () => {
      await logSecurityEvent(mockEvent);

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SecurityEventType.LOGIN_SUCCESS,
          severity: SecurityEventSeverity.LOW,
          userId: 'user_123',
          metadata: expect.objectContaining({
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            sessionId: 'session_123',
            location: 'US',
          }),
        }),
      });
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockPrisma.securityEvent.create.mockRejectedValueOnce(error);

      await expect(logSecurityEvent(mockEvent)).rejects.toThrow('Database connection failed');
    });

    it('should retry on transient errors', async () => {
      const transientError = new Error('Connection timeout');
      mockPrisma.securityEvent.create
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ id: 'event_123' });

      await logSecurityEvent(mockEvent);

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error for critical events after max retries', async () => {
      const mockCriticalEvent = {
        ...mockEvent,
        severity: SecurityEventSeverity.CRITICAL,
      };

      const error = new Error('Database error');
      mockPrisma.securityEvent.create.mockRejectedValue(error);

      await expect(logSecurityEvent(mockCriticalEvent)).rejects.toThrow('Database error');
    });

    it('should check for suspicious activity patterns', async () => {
      mockPrisma.securityEvent.findMany.mockResolvedValueOnce([
        { type: SecurityEventType.LOGIN_FAILURE, createdAt: new Date() },
        { type: SecurityEventType.LOGIN_FAILURE, createdAt: new Date() },
        { type: SecurityEventType.LOGIN_FAILURE, createdAt: new Date() },
      ]);

      await logSecurityEvent({
        ...mockEvent,
        type: SecurityEventType.LOGIN_FAILURE,
      });

      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: SecurityEventType.SUSPICIOUS_ACTIVITY,
            severity: SecurityEventSeverity.HIGH,
          }),
        })
      );
    });
  });

  afterAll(async () => {
    await mockPrisma.$disconnect();
  });
}); 