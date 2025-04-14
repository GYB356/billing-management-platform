import { prisma } from '@/lib/prisma';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Payment, PaymentProcessor } from '@prisma/client';

const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY;
const IV_LENGTH = 16;

export class SecurePaymentService {
  private encryptSensitiveData(data: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY!, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  private decryptSensitiveData(encryptedData: string): string {
    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY!, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async processPayment(
    amount: number,
    currency: string,
    paymentMethodId: string,
    customerId: string,
    metadata: Record<string, any>
  ): Promise<Payment> {
    return await prisma.$transaction(async (tx) => {
      try {
        // Encrypt sensitive payment data
        const encryptedPaymentMethodId = this.encryptSensitiveData(paymentMethodId);
        
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            amount,
            currency,
            status: 'PENDING',
            customerId,
            encryptedPaymentMethodId,
            processor: PaymentProcessor.STRIPE,
            metadata: metadata
          }
        });

        // Process payment with Stripe
        const stripePayment = await this.processStripePayment(
          amount,
          currency,
          paymentMethodId,
          customerId
        );

        // Update payment record with result
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: stripePayment.status,
            stripePaymentId: stripePayment.id,
            metadata: {
              ...metadata,
              stripeResponse: stripePayment
            }
          }
        });

        return updatedPayment;
      } catch (error) {
        // Log error with proper sanitization
        console.error('Payment processing failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId,
          amount,
          currency
        });
        throw error;
      }
    });
  }

  private async processStripePayment(
    amount: number,
    currency: string,
    paymentMethodId: string,
    customerId: string
  ) {
    // Implement Stripe payment processing with proper error handling
    // This is a placeholder - implement actual Stripe integration
    return {
      id: 'pi_123',
      status: 'succeeded'
    };
  }

  async getPaymentDetails(paymentId: string): Promise<Payment> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Decrypt sensitive data when needed
    if (payment.encryptedPaymentMethodId) {
      const decryptedPaymentMethodId = this.decryptSensitiveData(payment.encryptedPaymentMethodId);
      return {
        ...payment,
        encryptedPaymentMethodId: decryptedPaymentMethodId
      };
    }

    return payment;
  }
} 