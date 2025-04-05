import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    await resend.emails.send({
      from: 'Billing Platform <noreply@yourdomain.com>',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string) {
  const verificationToken = crypto.randomUUID();
  
  await prisma.user.update({
    where: { email },
    data: {
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${verificationToken}`;

  await sendEmail({
    to: email,
    subject: 'Verify your email address',
    html: `
      <h1>Verify your email address</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  });
}

export async function sendSubscriptionConfirmationEmail(
  email: string,
  planName: string,
  amount: number,
  interval: string,
  startDate: Date
) {
  await sendEmail({
    to: email,
    subject: 'Subscription Confirmed',
    html: `
      <h1>Subscription Confirmed</h1>
      <p>Thank you for subscribing to our platform!</p>
      <h2>Subscription Details:</h2>
      <ul>
        <li>Plan: ${planName}</li>
        <li>Amount: $${amount}</li>
        <li>Interval: ${interval}</li>
        <li>Start Date: ${startDate.toLocaleDateString()}</li>
      </ul>
      <p>You can manage your subscription at any time in your account settings.</p>
    `,
  });
}

export async function sendSubscriptionUpdateEmail(
  email: string,
  oldPlan: string,
  newPlan: string,
  effectiveDate: Date
) {
  await sendEmail({
    to: email,
    subject: 'Subscription Updated',
    html: `
      <h1>Subscription Updated</h1>
      <p>Your subscription has been updated successfully.</p>
      <h2>Changes:</h2>
      <ul>
        <li>Previous Plan: ${oldPlan}</li>
        <li>New Plan: ${newPlan}</li>
        <li>Effective Date: ${effectiveDate.toLocaleDateString()}</li>
      </ul>
      <p>You can view your updated subscription details in your account settings.</p>
    `,
  });
}

export async function sendSubscriptionCancellationEmail(
  email: string,
  planName: string,
  endDate: Date
) {
  await sendEmail({
    to: email,
    subject: 'Subscription Cancelled',
    html: `
      <h1>Subscription Cancelled</h1>
      <p>Your subscription has been cancelled successfully.</p>
      <h2>Details:</h2>
      <ul>
        <li>Plan: ${planName}</li>
        <li>End Date: ${endDate.toLocaleDateString()}</li>
      </ul>
      <p>You can resubscribe at any time from your account settings.</p>
    `,
  });
}

interface PaymentFailedEmailData {
  amount: number;
  dueDate: Date;
  retryDate: Date;
}

export async function sendPaymentFailedEmail(
  email: string,
  data: PaymentFailedEmailData
) {
  try {
    await resend.emails.send({
      from: 'Billing Management Platform <billing@example.com>',
      to: email,
      subject: 'Payment Failed',
      html: `
        <h1>Payment Failed</h1>
        <p>We were unable to process your payment of ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(data.amount)}.</p>
        <p>Due Date: ${data.dueDate.toLocaleDateString()}</p>
        <p>Next Retry: ${data.retryDate.toLocaleDateString()}</p>
        <p>Please update your payment method in your account settings to avoid service interruption.</p>
      `,
    });
  } catch (error) {
    console.error('Error sending payment failed email:', error);
  }
}

export async function sendPaymentSucceededEmail(email: string, amount: number) {
  try {
    await resend.emails.send({
      from: 'Billing Management Platform <billing@example.com>',
      to: email,
      subject: 'Payment Successful',
      html: `
        <h1>Payment Successful</h1>
        <p>Your payment of ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount)} has been processed successfully.</p>
        <p>Thank you for your business!</p>
      `,
    });
  } catch (error) {
    console.error('Error sending payment succeeded email:', error);
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html: `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

export async function sendSubscriptionPauseEmail(
  email: string,
  planName: string,
  pausedAt: Date,
  resumesAt: Date,
  reason?: string
) {
  try {
    await resend.emails.send({
      from: 'Billing Platform <noreply@yourdomain.com>',
      to: email,
      subject: 'Subscription Paused',
      html: `
        <h1>Subscription Paused</h1>
        <p>Your subscription to the ${planName} plan has been paused.</p>
        <p><strong>Paused at:</strong> ${pausedAt.toLocaleDateString()}</p>
        <p><strong>Resumes at:</strong> ${resumesAt.toLocaleDateString()}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>During the pause period:</p>
        <ul>
          <li>You will not be charged</li>
          <li>Your subscription features will be limited</li>
          <li>You can resume your subscription at any time</li>
        </ul>
        <p>If you have any questions, please contact our support team.</p>
      `,
    });
  } catch (error) {
    console.error('Error sending pause email:', error);
    throw error;
  }
}

export async function sendSubscriptionResumeEmail(
  email: string,
  planName: string,
  resumedAt: Date
) {
  try {
    await resend.emails.send({
      from: 'Billing Platform <noreply@yourdomain.com>',
      to: email,
      subject: 'Subscription Resumed',
      html: `
        <h1>Subscription Resumed</h1>
        <p>Your subscription to the ${planName} plan has been resumed.</p>
        <p><strong>Resumed at:</strong> ${resumedAt.toLocaleDateString()}</p>
        <p>Your subscription features are now fully restored, and regular billing will resume on your next billing cycle.</p>
        <p>If you have any questions, please contact our support team.</p>
      `,
    });
  } catch (error) {
    console.error('Error sending resume email:', error);
    throw error;
  }
} 