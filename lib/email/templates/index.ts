import { EmailTemplate } from '../types';

export const emailTemplates = {
  resetPassword: (resetUrl: string): EmailTemplate => ({
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Reset Your Password</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </body>
      </html>
    `,
    text: `Reset your password by clicking: ${resetUrl}\nThis link will expire in 24 hours.`
  }),

  subscriptionPaused: (params: {
    planName: string;
    pausedAt: Date;
    resumesAt: Date;
    reason?: string;
  }): EmailTemplate => ({
    subject: 'Subscription Paused',
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Subscription Paused</h1>
          <p>Your subscription to the ${params.planName} plan has been paused.</p>
          <p><strong>Paused at:</strong> ${params.pausedAt.toLocaleDateString()}</p>
          <p><strong>Resumes at:</strong> ${params.resumesAt.toLocaleDateString()}</p>
          ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ''}
          <p>During the pause period:</p>
          <ul>
            <li>You will not be charged</li>
            <li>Your subscription features will be limited</li>
            <li>You can resume your subscription at any time</li>
          </ul>
          <p>If you have any questions, please contact our support team.</p>
        </body>
      </html>
    `,
    text: `Your subscription to the ${params.planName} plan has been paused.\n\nPaused at: ${params.pausedAt.toLocaleDateString()}\nResumes at: ${params.resumesAt.toLocaleDateString()}\n${params.reason ? `\nReason: ${params.reason}` : ''}\n\nDuring the pause period:\n- You will not be charged\n- Your subscription features will be limited\n- You can resume your subscription at any time\n\nIf you have any questions, please contact our support team.`
  }),

  subscriptionResumed: (params: {
    planName: string;
    resumedAt: Date;
  }): EmailTemplate => ({
    subject: 'Subscription Resumed',
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Subscription Resumed</h1>
          <p>Your subscription to the ${params.planName} plan has been resumed.</p>
          <p><strong>Resumed at:</strong> ${params.resumedAt.toLocaleDateString()}</p>
          <p>Your subscription features are now fully restored, and regular billing will resume on your next billing cycle.</p>
          <p>If you have any questions, please contact our support team.</p>
        </body>
      </html>
    `,
    text: `Your subscription to the ${params.planName} plan has been resumed.\n\nResumed at: ${params.resumedAt.toLocaleDateString()}\n\nYour subscription features are now fully restored, and regular billing will resume on your next billing cycle.\n\nIf you have any questions, please contact our support team.`
  }),

  paymentRetry: (params: {
    amount: number;
    currency: string;
    retryDate: Date;
  }): EmailTemplate => ({
    subject: 'Payment Retry Scheduled',
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Payment Retry Scheduled</h1>
          <p>Your payment of ${params.amount} ${params.currency} will be retried on ${params.retryDate.toLocaleDateString()}.</p>
          <p>Please ensure your payment method has sufficient funds.</p>
        </body>
      </html>
    `,
    text: `Your payment of ${params.amount} ${params.currency} will be retried on ${params.retryDate.toLocaleDateString()}.\n\nPlease ensure your payment method has sufficient funds.`
  })
}; 