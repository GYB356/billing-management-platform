import { PayPalService } from '@/lib/paypal';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { createNotification } from '@/lib/notifications';

// Mock dependencies
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      payment: {
        update: jest.fn(),
      },
    })),
    $disconnect: jest.fn(),
  })),
  PaymentStatus: {
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
  },
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(),
}));

describe('PayPalService', () => {
  let paypalService: PayPalService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    paypalService = new PayPalService();
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe('handleWebhookEvent', () => {
    const mockWebhookEvent = {
      id: 'evt_123',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'res_123',
        status: 'COMPLETED',
        supplementary_data: {
          related_ids: {
            order_id: 'order_123',
          },
        },
      },
      create_time: '2024-01-01T00:00:00Z',
    };

    it('should handle successful payment capture', async () => {
      // Mock payment record
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'payment_123',
        organizationId: 'org_123',
        metadata: {},
        amount: 1000,
      });

      await paypalService.handleWebhookEvent(mockWebhookEvent);

      // Verify payment update
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment_123' },
        data: expect.objectContaining({
          status: PaymentStatus.SUCCEEDED,
        }),
      });
    });

    it('should handle failed payment capture', async () => {
      const failedEvent = {
        ...mockWebhookEvent,
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          ...mockWebhookEvent.resource,
          status: 'DENIED',
          status_details: {
            reason: 'INSUFFICIENT_FUNDS',
          },
        },
      };

      // Mock payment record
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        id: 'payment_123',
        organizationId: 'org_123',
        metadata: {},
        amount: 1000,
      });

      await paypalService.handleWebhookEvent(failedEvent);

      // Verify payment update
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment_123' },
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
        }),
      });

      // Verify notification creation
      expect(createNotification).toHaveBeenCalledWith({
        organizationId: 'org_123',
        title: 'Payment Failed',
        message: 'INSUFFICIENT_FUNDS',
        type: 'ERROR',
        metadata: expect.any(Object),
      });
    });

    it('should handle missing payment record', async () => {
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);

      await expect(paypalService.handleWebhookEvent(mockWebhookEvent))
        .rejects
        .toThrow('Payment record not found');
    });

    it('should handle database errors', async () => {
      mockPrisma.payment.findFirst.mockRejectedValueOnce(new Error('Database error'));

      await expect(paypalService.handleWebhookEvent(mockWebhookEvent))
        .rejects
        .toThrow('Database error');
    });
  });

  afterAll(async () => {
    await paypalService.disconnect();
  });
});