import { createPayment, getPaymentMethod } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { Payment, PaymentMethod } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentMethod: {
        findFirst: vi.fn()
    }
  },
}));

describe('Payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should call the database and return the correct response', async () => {
      const mockedPayment = {
        id: 'payment-id',
        userId: 'user-id',
        amount: 100,
        currency: 'USD',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentMethodId: "payment-method-id"
      } as Payment;

      (prisma.payment.create as vi.Mock).mockResolvedValue(mockedPayment);

      const payment = await createPayment({
        userId: 'user-id',
        amount: 100,
        currency: 'USD',
        paymentMethodId: "payment-method-id"
      });

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          amount: 100,
          currency: 'USD',
          paymentMethodId: "payment-method-id"
        },
      });
      expect(payment).toEqual(mockedPayment);
    });
  });

    describe('getPaymentMethod', () => {
        it('should call the database and return the correct response', async () => {
        const mockedPaymentMethod = {
            id: 'payment-method-id',
            userId: 'user-id',
            type: 'CRYPTO',
            createdAt: new Date(),
            updatedAt: new Date(),
            cryptoAddress: "crypto-address"
        } as PaymentMethod;

        (prisma.paymentMethod.findFirst as vi.Mock).mockResolvedValue(mockedPaymentMethod);

        const paymentMethod = await getPaymentMethod("payment-method-id");

        expect(prisma.paymentMethod.findFirst).toHaveBeenCalledWith({
            where: {
            id: "payment-method-id"
            },
        });
        expect(paymentMethod).toEqual(mockedPaymentMethod);
        });
    });
});