import { billingAssistant } from '../../../services/ai/billingAssistant';
import OpenAI from 'openai';

describe('BillingAssistant', () => {
  const mockQuestion = 'How do I update my billing information?';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBillingQuery', () => {
    it('should return AI-generated response for valid query', async () => {
      const response = await billingAssistant.handleBillingQuery(mockQuestion);
      
      expect(response).toBe('Mocked AI response');
    });

    it('should throw error when OpenAI API fails', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(OpenAI.prototype.chat.completions, 'create')
        .mockRejectedValueOnce(mockError);

      await expect(billingAssistant.handleBillingQuery(mockQuestion))
        .rejects
        .toThrow('Failed to process billing query');
    });

    it('should use correct prompt format', async () => {
      const createSpy = jest.spyOn(OpenAI.prototype.chat.completions, 'create');
      
      await billingAssistant.handleBillingQuery(mockQuestion);

      expect(createSpy).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful billing assistant that helps users with billing-related questions."
          },
          {
            role: "user",
            content: mockQuestion
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
    });
  });
}); 