import { Resend } from 'resend';
<<<<<<< HEAD
import { prisma } from './prisma';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
=======
import { prisma } from './db';
import crypto from 'crypto';
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set, emails will not be sent');
}

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL || 'Billing Platform <noreply@yourdomain.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

<<<<<<< HEAD
// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
=======
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
<<<<<<< HEAD
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email not sent.');
    return process.env.NODE_ENV === 'development';
  }

  const msg = {
    to: options.to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
    subject: options.subject,
    text: options.text,
    html: options.html || options.text,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
=======
  const { to, subject, html, from = DEFAULT_FROM_EMAIL, replyTo, cc, bcc, attachments } = options;
  
  try {
    if (!resend) {
      console.log('Email would have been sent:', { to, subject });
      return process.env.NODE_ENV === 'development';
    }

    await resend.emails.send({
      from,
      to,
      subject,
      html,
      reply_to: replyTo,
      cc,
      bcc,
      attachments,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
    return false;
  }
}

/**
 * Send a verification email
 */
export async function sendVerificationEmail(email: string): Promise<boolean> {
  try {
    const verificationToken = crypto.randomUUID();
    
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: null, // Mark as unverified
        verificationToken,
        verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const verificationUrl = `${APP_URL}/auth/verify?token=${verificationToken}`;

    return await sendEmail({
      to: email,
      subject: 'Verify your email address',
<<<<<<< HEAD
      text: `
=======
      html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
        <h1>Verify your email address</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

/**
 * Send a subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  email: string,
  planName: string,
  amount: number,
  currency: string = 'USD',
  interval: string,
  startDate: Date
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100);

  return await sendEmail({
    to: email,
    subject: 'Subscription Confirmed',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <h1>Subscription Confirmed</h1>
      <p>Thank you for subscribing to our platform!</p>
      <h2>Subscription Details:</h2>
      <ul>
        <li>Plan: ${planName}</li>
        <li>Amount: ${formattedAmount}</li>
        <li>Interval: ${interval}</li>
        <li>Start Date: ${startDate.toLocaleDateString()}</li>
      </ul>
      <p>You can manage your subscription at any time in your account settings.</p>
    `,
  });
}

/**
 * Send a subscription update email
 */
export async function sendSubscriptionUpdateEmail(
  email: string,
  oldPlan: string,
  newPlan: string,
  effectiveDate: Date
): Promise<boolean> {
  return await sendEmail({
    to: email,
    subject: 'Subscription Updated',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
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

/**
 * Send a subscription cancellation email
 */
export async function sendSubscriptionCancellationEmail(
  email: string,
  planName: string,
  endDate: Date
): Promise<boolean> {
  return await sendEmail({
    to: email,
    subject: 'Subscription Cancelled',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
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

/**
 * Interface for payment failed email data
 */
interface PaymentFailedEmailData {
  amount: number;
  currency?: string;
  dueDate: Date;
  retryDate?: Date;
  invoiceId?: string;
  paymentMethod?: string;
<<<<<<< HEAD
  error?: string;
=======
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
}

/**
 * Send a payment failed email
 */
export async function sendPaymentFailedEmail(
  email: string,
  data: PaymentFailedEmailData
): Promise<boolean> {
<<<<<<< HEAD
  const { amount, currency = 'USD', dueDate, retryDate, invoiceId, paymentMethod, error } = data;
=======
  const { amount, currency = 'USD', dueDate, retryDate, invoiceId, paymentMethod } = data;
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
  
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100);

  return await sendEmail({
    to: email,
    subject: 'Payment Failed',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <h1>Payment Failed</h1>
      <p>We were unable to process your payment of ${formattedAmount}.</p>
      <p>Due Date: ${dueDate.toLocaleDateString()}</p>
      ${retryDate ? `<p>Next Retry: ${retryDate.toLocaleDateString()}</p>` : ''}
      ${invoiceId ? `<p>Invoice ID: ${invoiceId}</p>` : ''}
      ${paymentMethod ? `<p>Payment Method: ${paymentMethod}</p>` : ''}
<<<<<<< HEAD
      ${error ? `<p>Error: ${error}</p>` : ''}
=======
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <p>Please update your payment method in your account settings to avoid service interruption.</p>
    `,
  });
}

/**
 * Send a payment succeeded email
 */
export async function sendPaymentSucceededEmail(
  email: string, 
  amount: number,
  currency: string = 'USD',
  invoiceId?: string,
  paymentDate: Date = new Date()
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100);

  return await sendEmail({
    to: email,
    subject: 'Payment Successful',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <h1>Payment Successful</h1>
      <p>Your payment of ${formattedAmount} has been processed successfully.</p>
      <p>Date: ${paymentDate.toLocaleDateString()}</p>
      ${invoiceId ? `<p>Invoice ID: ${invoiceId}</p>` : ''}
      <p>Thank you for your business!</p>
    `,
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string
): Promise<boolean> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${resetToken}`;

  return await sendEmail({
    to: email,
    subject: 'Reset Your Password',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

/**
 * Send a subscription pause email
 */
export async function sendSubscriptionPauseEmail(
  email: string,
  planName: string,
  pausedAt: Date,
  resumesAt: Date,
  reason?: string
): Promise<boolean> {
  return await sendEmail({
    to: email,
    subject: 'Subscription Paused',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
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
}

/**
 * Send a subscription resume email
 */
export async function sendSubscriptionResumeEmail(
  email: string,
  planName: string,
  resumedAt: Date
): Promise<boolean> {
  return await sendEmail({
    to: email,
    subject: 'Subscription Resumed',
<<<<<<< HEAD
    text: `
=======
    html: `
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
      <h1>Subscription Resumed</h1>
      <p>Your subscription to the ${planName} plan has been resumed.</p>
      <p><strong>Resumed at:</strong> ${resumedAt.toLocaleDateString()}</p>
      <p>Your subscription features are now fully restored, and regular billing will resume on your next billing cycle.</p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  });
<<<<<<< HEAD
}

export async function sendPaymentRetryEmail(to: string, amount: number, currency: string, retryDate: Date): Promise<void> {
  await sendEmail({
    to,
    subject: 'Payment Retry Scheduled',
    text: `Your payment of ${amount} ${currency} will be retried on ${retryDate.toLocaleDateString()}.`,
    html: `
      <h1>Payment Retry Scheduled</h1>
      <p>Your payment of ${amount} ${currency} will be retried on ${retryDate.toLocaleDateString()}.</p>
      <p>Please ensure your payment method has sufficient funds.</p>
    `,
  });
=======
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
} 