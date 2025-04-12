import OpenAI from 'openai';
import { sendEmail } from '../notifications';

interface BillingActivity {
  timestamp: Date;
  amount: number;
  description: string;
  status: 'success' | 'failed';
  customerId: string;
}

class BillingSummarizer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateWeeklySummary(activities: BillingActivity[]): Promise<string> {
    const totalAmount = activities.reduce((sum, act) => sum + (act.status === 'success' ? act.amount : 0), 0);
    const failedTransactions = activities.filter(act => act.status === 'failed').length;
    const successRate = ((activities.length - failedTransactions) / activities.length) * 100;

    const summaryData = `
      Total Transactions: ${activities.length}
      Total Amount: $${totalAmount.toFixed(2)}
      Failed Transactions: ${failedTransactions}
      Success Rate: ${successRate.toFixed(1)}%
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional business analyst. Create a concise weekly billing summary from the provided data."
          },
          {
            role: "user",
            content: `Please create a professional summary of this week's billing activity: ${summaryData}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message.content || this.generateFallbackSummary(summaryData);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return this.generateFallbackSummary(summaryData);
    }
  }

  private generateFallbackSummary(summaryData: string): string {
    return `Weekly Billing Summary\n${summaryData}`;
  }

  async sendWeeklySummary(activities: BillingActivity[]): Promise<void> {
    const summary = await this.generateWeeklySummary(activities);
    
    // Group activities by customer
    const customerActivities = activities.reduce((acc, act) => {
      if (!acc[act.customerId]) {
        acc[act.customerId] = [];
      }
      acc[act.customerId].push(act);
      return acc;
    }, {} as Record<string, BillingActivity[]>);

    // Send summary to admins
    await sendEmail({
      to: process.env.ADMIN_EMAIL!,
      subject: 'Weekly Billing Summary',
      body: summary,
      type: 'admin'
    });

    // Send customer-specific summaries
    for (const [customerId, customerActs] of Object.entries(customerActivities)) {
      const customerSummary = await this.generateWeeklySummary(customerActs);
      await sendEmail({
        to: customerId, // Assuming customerId is the email address
        subject: 'Your Weekly Billing Summary',
        body: customerSummary,
        type: 'customer'
      });
    }
  }
}

export const billingSummarizer = new BillingSummarizer();