import { expect } from 'chai';
import * as sinon from 'sinon';
import { PaymentService } from '../../services/payment.service';
import { EncryptionService } from '../../services/encryption.service';
import { PaymentRepository } from '../../repositories/payment.repository';
import { PaymentError, ValidationError } from '../../utils/errors';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let encryptionService: EncryptionService;
  let paymentRepository: PaymentRepository;
  
  beforeEach(() => {
    // Create fresh instances for each test
    encryptionService = new EncryptionService();
    paymentRepository = new PaymentRepository();
    paymentService = new PaymentService();
    
    // Inject mocked dependencies
    (paymentService as any).encryptionService = encryptionService;
    (paymentService as any).paymentRepository = paymentRepository;
  });
  
  afterEach(() => {
    // Clean up all stubs/mocks
    sinon.restore();
  });
  
  describe('processPayment', () => {
    const validPaymentData = {
      userId: 'user-123',
      cardNumber: '4242424242424242',
      cvv: '123',
      expiryMonth: '12',
      expiryYear: '2030',
      amount: 100,
      currency: 'USD',
      description: 'Test payment'
    };
    
    it('should successfully process a valid payment', async () => {
      // Arrange
      const encryptedCard = { encryptedData: 'encrypted', iv: 'iv', authTag: 'tag' };
      const encryptStub = sinon.stub(encryptionService, 'encrypt').returns(encryptedCard);
      
      const gatewayResponse = {
        transactionId: 'tx_123',
        status: 'succeeded' as const,
        lastFourDigits: '4242',
        amount: 100,
        currency: 'USD'
      };
      
      const processWithGatewaySpy = sinon.stub(
        paymentService as any,
        'processWithGateway'
      ).resolves(gatewayResponse);
      
      const savePaymentStub = sinon.stub(paymentRepository, 'savePaymentInfo').resolves();
      
      // Act
      const result = await paymentService.processPayment(validPaymentData);
      
      // Assert
      expect(result.status).to.equal('succeeded');
      expect(result.transactionId).to.equal('tx_123');
      expect(result.lastFourDigits).to.equal('4242');
      
      // Verify card data was encrypted
      expect(encryptStub.calledTwice).to.be.true;
      expect(encryptStub.firstCall.args[0]).to.equal(validPaymentData.cardNumber);
      expect(encryptStub.secondCall.args[0]).to.equal(validPaymentData.cvv);
      
      // Verify payment was saved
      expect(savePaymentStub.calledOnce).to.be.true;
      const savedData = savePaymentStub.firstCall.args[0];
      expect(savedData.userId).to.equal(validPaymentData.userId);
      expect(savedData.lastFourDigits).to.equal('4242');
      expect(savedData.encryptedCardData).to.deep.equal({
        cardNumber: encryptedCard,
        cvv: encryptedCard
      });
    });
    
    it('should validate card number using Luhn algorithm', async () => {
      // Arrange
      const invalidCardData = {
        ...validPaymentData,
        cardNumber: '4242424242424241' // Invalid checksum
      };
      
      try {
        // Act
        await paymentService.processPayment(invalidCardData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Assert
        expect(error).to.be.instanceOf(ValidationError);
        expect(error.errors).to.have.property('cardNumber', 'Invalid card number');
      }
    });
    
    it('should handle payment gateway errors appropriately', async () => {
      // Arrange
      const gatewayError = {
        code: 'card_declined',
        message: 'Your card was declined'
      };
      
      sinon.stub(paymentService as any, 'processWithGateway').rejects(gatewayError);
      
      try {
        // Act
        await paymentService.processPayment(validPaymentData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Assert
        expect(error).to.be.instanceOf(PaymentError);
        expect(error.code).to.equal('CARD_DECLINED');
        expect(error.gatewayResponse).to.deep.equal({ decline_code: 'card_declined' });
      }
    });
    
    it('should validate expiry dates', async () => {
      // Arrange
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      
      const expiredCardData = {
        ...validPaymentData,
        expiryYear: pastDate.getFullYear().toString(),
        expiryMonth: '12'
      };
      
      try {
        // Act
        await paymentService.processPayment(expiredCardData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Assert
        expect(error).to.be.instanceOf(ValidationError);
        expect(error.errors).to.have.property('expiryYear');
      }
    });
  });
}); 