import { billingSummarizer } from '../../../services/reporting/billingSummary';
import { sendEmail } from '../../../services/notifications';
import OpenAI from 'openai';

jest.mock('../../../services/notifications');

describe('BillingSummarizer', () => {
  const mockActivities = [
    {
      timestamp: new Date(),
      amount: 100,
      description: 'Subscription',
      status: 'success' as const,
      customerId: 'customer1@example.com'
    },
    {
      timestamp: new Date(),
      amount: 50,
      description: 'One-time purchase',
      status: 'failed' as const,
      customerId: 'customer1@example.com'
    },
    {
      timestamp: new Date(),
      amount: 75,
      description: 'Service fee',
      status: 'success' as const,
      customerId: 'customer2@example.com'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWeeklySummary', () => {
    it('should generate summary with correct calculations', async () => {
      const summary = await billingSummarizer.generateWeeklySummary(mockActivities);

      expect(summary).toBe('Mocked AI response');
    });

    it('should handle empty activities list', async () => {
      const summary = await billingSummarizer.generateWeeklySummary([]);

      expect(summary).toContain('Total Transactions: 0');
    });

    it('should use fallback summary on AI error', async () => {
      jest.spyOn(OpenAI.prototype.chat.completions, 'create')
        .mockRejectedValueOnce(new Error('API Error'));

      const summary = await billingSummarizer.generateWeeklySummary(mockActivities);

      expect(summary).toContain('Weekly Billing Summary');
      expect(summary).toContain('Total Transactions: 3');
      expect(summary).toContain('Total Amount: $175.00');
    });
  });

  describe('sendWeeklySummary', () => {
    it('should send admin summary', async () => {
      await billingSummarizer.sendWeeklySummary(mockActivities);

      expect(sendEmail).toHaveBeenCalledWith({
        to: process.env.ADMIN_EMAIL,
        subject: 'Weekly Billing Summary',
        body: expect.any(String),
        type: 'admin'
      });
    });

    it('should send customer-specific summaries', async () => {
      await billingSummarizer.sendWeeklySummary(mockActivities);

      // Should send to both customers
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer1@example.com',
          subject: 'Your Weekly Billing Summary',
          type: 'customer'
        })
      );

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer2@example.com',
          subject: 'Your Weekly Billing Summary',
          type: 'customer'
        })
      );
    });

    it('should handle empty activities list', async () => {
      await billingSummarizer.sendWeeklySummary([]);

      expect(sendEmail).toHaveBeenCalledTimes(1); // Only admin email
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: process.env.ADMIN_EMAIL,
          type: 'admin'
        })
      );
    });

    it('should continue sending remaining emails if one fails', async () => {
      const mockSendEmail = sendEmail as jest.Mock;
      mockSendEmail
        .mockRejectedValueOnce(new Error('Failed to send'))
        .mockResolvedValue(undefined);

      await billingSummarizer.sendWeeklySummary(mockActivities);

      expect(sendEmail).toHaveBeenCalledTimes(3); // Should try all emails
    });
  });
});