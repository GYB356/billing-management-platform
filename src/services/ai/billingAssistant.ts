import OpenAI from 'openai';

class BillingAssistant {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async handleBillingQuery(query: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful billing assistant that helps users with billing-related questions."
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message.content || "I couldn't process your question. Please try again.";
    } catch (error) {
      console.error('Error handling billing query:', error);
      throw new Error('Failed to process billing query');
    }
  }
}

export const billingAssistant = new BillingAssistant(); 