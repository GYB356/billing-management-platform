import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { Transaction } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface SecurePaymentData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

interface PaymentResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export class SecurePaymentService {
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.PAYMENT_ENCRYPTION_KEY;
    if (!this.encryptionKey) {
      throw new Error('Payment encryption key not configured');
    }
  }

  async processPayment(
    paymentData: SecurePaymentData,
    amount: number,
    currency: string,
    metadata: Record<string, any>
  ): Promise<PaymentResult> {
    const transactionId = uuidv4();
    
    try {
      // Start a database transaction
      return await prisma.$transaction(async (tx) => {
        // Encrypt sensitive data
        const encryptedData = this.encryptPaymentData(paymentData);
        
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            id: transactionId,
            amount,
            currency,
            status: 'PENDING',
            encryptedData,
            metadata,
          },
        });

        // Process payment with payment processor
        const processorResult = await this.processWithPaymentProcessor(paymentData, amount, currency);
        
        if (!processorResult.success) {
          throw new Error(processorResult.error);
        }

        // Update payment status
        await tx.payment.update({
          where: { id: transactionId },
          data: { status: 'COMPLETED' },
        });

        return {
          success: true,
          transactionId,
        };
      });
    } catch (error) {
      // Log error with proper sanitization
      console.error('Payment processing failed:', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        transactionId,
        error: 'Payment processing failed',
      };
    }
  }

  private encryptPaymentData(data: SecurePaymentData): string {
    return encrypt(JSON.stringify(data), this.encryptionKey);
  }

  private decryptPaymentData(encryptedData: string): SecurePaymentData {
    return JSON.parse(decrypt(encryptedData, this.encryptionKey));
  }

  private async processWithPaymentProcessor(
    paymentData: SecurePaymentData,
    amount: number,
    currency: string
  ): Promise<{ success: boolean; error?: string }> {
    // Implement actual payment processor integration
    // This is a placeholder for the actual implementation
    return { success: true };
  }

  async getPaymentDetails(transactionId: string): Promise<SecurePaymentData | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: transactionId },
    });

    if (!payment) {
      return null;
    }

    return this.decryptPaymentData(payment.encryptedData);
  }
} 