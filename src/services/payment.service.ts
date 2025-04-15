import { EncryptionService } from './encryption.service';
import { PaymentRepository } from '../repositories/payment.repository';
import { Logger } from '../utils/logger';
import { PaymentError, ValidationError } from '../utils/errors';

interface PaymentRequestDto {
  userId: string;
  cardNumber: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  amount: number;
  currency: string;
  description?: string;
}

interface PaymentResult {
  transactionId: string;
  status: 'succeeded' | 'failed';
  lastFourDigits: string;
  amount: number;
  currency: string;
}

export class PaymentService {
  private encryptionService: EncryptionService;
  private paymentRepository: PaymentRepository;
  
  constructor() {
    this.encryptionService = new EncryptionService();
    this.paymentRepository = new PaymentRepository();
  }
  
  async processPayment(paymentData: PaymentRequestDto): Promise<PaymentResult> {
    try {
      // Validate input
      this.validatePaymentInput(paymentData);
      
      // Encrypt sensitive data
      const { cardNumber, cvv } = paymentData;
      const encryptedCardNumber = this.encryptionService.encrypt(cardNumber);
      const encryptedCvv = this.encryptionService.encrypt(cvv);
      
      // Store only last 4 digits in plaintext
      const lastFourDigits = cardNumber.slice(-4);
      
      // Process payment with gateway
      const paymentResult = await this.processWithGateway({
        ...paymentData,
        cardNumber, // Use plaintext for gateway call
        cvv
      });
      
      // Store encrypted payment info
      await this.paymentRepository.savePaymentInfo({
        userId: paymentData.userId,
        lastFourDigits,
        encryptedCardData: {
          cardNumber: encryptedCardNumber,
          cvv: encryptedCvv
        },
        paymentId: paymentResult.transactionId,
        status: paymentResult.status,
        amount: paymentData.amount,
        currency: paymentData.currency
      });
      
      return {
        ...paymentResult,
        lastFourDigits,
        amount: paymentData.amount,
        currency: paymentData.currency
      };
    } catch (error) {
      Logger.error('Payment processing error', { error });
      
      if (error instanceof PaymentError || error instanceof ValidationError) {
        throw error;
      }
      
      throw new PaymentError(
        'Payment processing failed',
        'PROCESSING_ERROR',
        error.message
      );
    }
  }
  
  private validatePaymentInput(data: PaymentRequestDto): void {
    const errors: Record<string, string> = {};
    
    if (!this.isValidCardNumber(data.cardNumber)) {
      errors.cardNumber = 'Invalid card number';
    }
    
    if (!this.isValidCvv(data.cvv)) {
      errors.cvv = 'Invalid CVV';
    }
    
    if (!this.isValidExpiryMonth(data.expiryMonth)) {
      errors.expiryMonth = 'Invalid expiry month';
    }
    
    if (!this.isValidExpiryYear(data.expiryYear)) {
      errors.expiryYear = 'Invalid expiry year';
    }
    
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Invalid payment details', errors);
    }
  }
  
  private isValidCardNumber(cardNumber: string): boolean {
    // Implement Luhn algorithm check
    return /^\d{16}$/.test(cardNumber) && this.luhnCheck(cardNumber);
  }
  
  private luhnCheck(cardNumber: string): boolean {
    const digits = cardNumber.split('').map(Number);
    let sum = 0;
    let isEven = false;
    
    // Loop from right to left
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }
  
  private isValidCvv(cvv: string): boolean {
    return /^\d{3,4}$/.test(cvv);
  }
  
  private isValidExpiryMonth(month: string): boolean {
    const monthNum = parseInt(month, 10);
    return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
  }
  
  private isValidExpiryYear(year: string): boolean {
    const yearNum = parseInt(year, 10);
    const currentYear = new Date().getFullYear();
    return !isNaN(yearNum) && yearNum >= currentYear && yearNum <= currentYear + 20;
  }
  
  private async processWithGateway(paymentData: PaymentRequestDto): Promise<PaymentResult> {
    // TODO: Implement actual payment gateway integration
    // This is a placeholder that should be replaced with real payment gateway code
    return {
      transactionId: `tx_${Date.now()}`,
      status: 'succeeded',
      lastFourDigits: paymentData.cardNumber.slice(-4),
      amount: paymentData.amount,
      currency: paymentData.currency
    };
  }
} 