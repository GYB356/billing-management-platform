import { PrismaClient } from '@prisma/client';
import { SecurityEventType, AlertSeverity } from './types';
import { NextRequest } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface AlertConfig {
  type: SecurityEventType;
  severity: AlertSeverity;
  threshold: number;
  timeWindow: number; // in milliseconds
}

const ALERT_CONFIGS: AlertConfig[] = [
  {
    type: SecurityEventType.LOGIN_FAILURE,
    severity: 'HIGH',
    threshold: 5,
    timeWindow: 5 * 60 * 1000, // 5 minutes
  },
  {
    type: SecurityEventType.RATE_LIMIT_EXCEEDED,
    severity: 'MEDIUM',
    threshold: 100,
    timeWindow: 60 * 1000, // 1 minute
  },
  {
    type: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: 'CRITICAL',
    threshold: 1,
    timeWindow: 24 * 60 * 60 * 1000, // 24 hours
  },
];

const prisma = new PrismaClient();

export async function checkAndSendAlerts(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || req.ip;
  const userAgent = req.headers.get('user-agent');

  for (const config of ALERT_CONFIGS) {
    const timeThreshold = new Date(Date.now() - config.timeWindow);

    const recentEvents = await prisma.securityEvent.findMany({
      where: {
        type: config.type,
        timestamp: {
          gte: timeThreshold,
        },
        ipAddress,
      },
    });

    if (recentEvents.length >= config.threshold) {
      await prisma.securityAlert.create({
        data: {
          eventType: config.type,
          severity: config.severity,
          timestamp: new Date(),
          message: `Alert: ${config.type} threshold exceeded for IP ${ipAddress}`,
          resolved: false,
          details: {
            ipAddress,
            userAgent,
            eventCount: recentEvents.length,
            timeWindow: config.timeWindow,
          },
        },
      });
    }
  }
}

export { ALERT_CONFIGS };

async function sendAlert(data: {
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
}): Promise<void> {
  try {
    // Get admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true },
    });

    // Send email to each admin
    await Promise.all(
      admins.map((admin) =>
        resend.emails.send({
          from: 'Security Alerts <security@yourdomain.com>',
          to: admin.email,
          subject: `[${data.severity}] Security Alert: ${data.message}`,
          html: `
            <h2>Security Alert</h2>
            <p><strong>Type:</strong> ${data.type}</p>
            <p><strong>Severity:</strong> ${data.severity}</p>
            <p><strong>Message:</strong> ${data.message}</p>
            <h3>Details:</h3>
            <pre>${JSON.stringify(data.details, null, 2)}</pre>
          `,
        })
      )
    );

    // Log the alert
    await prisma.securityEvent.create({
      data: {
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: data.severity,
        ipAddress: data.details.ipAddress,
        userId: data.details.userId,
        details: {
          alertType: data.type,
          message: data.message,
          ...data.details,
        },
      },
    });
  } catch (error) {
    console.error('Failed to send security alert:', error);
  }
} 