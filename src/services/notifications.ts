import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  type: 'admin' | 'customer';
}

interface AlertOptions {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.body,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Email sending failed');
  }
}

export async function sendAlert(options: AlertOptions): Promise<void> {
  // Send alert to admin email
  await sendEmail({
    to: process.env.ADMIN_EMAIL!,
    subject: `[${options.severity.toUpperCase()}] ${options.type} Alert`,
    body: options.message,
    type: 'admin'
  });
} 