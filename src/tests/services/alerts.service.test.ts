import { expect } from 'chai';
import * as sinon from 'sinon';
import { AlertService } from '../../services/alerts.service';
import { NotificationService } from '../../services/notification.service';
import { AlertRepository } from '../../repositories/alert.repository';
import { AlertError } from '../../utils/errors';

describe('AlertService', () => {
  let alertService: AlertService;
  let notificationService: NotificationService;
  let alertRepository: AlertRepository;

  beforeEach(() => {
    notificationService = new NotificationService();
    alertRepository = new AlertRepository();
    alertService = new AlertService();
    
    // Inject dependencies
    (alertService as any).notificationService = notificationService;
    (alertService as any).alertRepository = alertRepository;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createAlert', () => {
    const validAlertData = {
      userId: 'user-123',
      type: 'PAYMENT_FAILED',
      severity: 'HIGH',
      message: 'Payment processing failed',
      metadata: {
        transactionId: 'tx_123',
        amount: 100
      }
    };

    it('should successfully create an alert', async () => {
      // Arrange
      const savedAlert = { ...validAlertData, id: 'alert-123', createdAt: new Date() };
      const saveAlertStub = sinon.stub(alertRepository, 'saveAlert').resolves(savedAlert);
      const sendNotificationStub = sinon.stub(notificationService, 'sendNotification').resolves();

      // Act
      const result = await alertService.createAlert(validAlertData);

      // Assert
      expect(result.id).to.equal('alert-123');
      expect(result.type).to.equal(validAlertData.type);
      expect(saveAlertStub.calledOnce).to.be.true;
      expect(sendNotificationStub.calledOnce).to.be.true;
    });

    it('should validate alert data', async () => {
      // Arrange
      const invalidAlertData = {
        ...validAlertData,
        severity: 'INVALID'
      };

      try {
        // Act
        await alertService.createAlert(invalidAlertData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Assert
        expect(error).to.be.instanceOf(AlertError);
        expect(error.message).to.include('Invalid severity level');
      }
    });

    it('should handle notification failures gracefully', async () => {
      // Arrange
      const savedAlert = { ...validAlertData, id: 'alert-123', createdAt: new Date() };
      sinon.stub(alertRepository, 'saveAlert').resolves(savedAlert);
      sinon.stub(notificationService, 'sendNotification').rejects(new Error('Notification failed'));

      // Act
      const result = await alertService.createAlert(validAlertData);

      // Assert
      expect(result.id).to.equal('alert-123');
      // Alert should be created even if notification fails
      expect(result.type).to.equal(validAlertData.type);
    });
  });
}); 