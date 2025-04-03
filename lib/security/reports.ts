import { prisma } from '@/lib/prisma';
import { SecurityEventType } from './logging';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SecurityReport {
  period: string;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  suspiciousActivities: number;
  uniqueIPs: number;
  uniqueUsers: number;
  criticalEvents: Array<{
    type: string;
    severity: string;
    timestamp: Date;
    details: any;
  }>;
}

export async function generateDailyReport(): Promise<SecurityReport> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return generateReport(yesterday, today, 'Daily');
}

export async function generateWeeklyReport(): Promise<SecurityReport> {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  lastWeek.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return generateReport(lastWeek, today, 'Weekly');
}

async function generateReport(
  startDate: Date,
  endDate: Date,
  period: string
): Promise<SecurityReport> {
  const events = await prisma.securityEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const report: SecurityReport = {
    period,
    totalEvents: events.length,
    eventsByType: events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    eventsBySeverity: events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    suspiciousActivities: events.filter(
      (event) => event.eventType === SecurityEventType.SUSPICIOUS_ACTIVITY
    ).length,
    uniqueIPs: new Set(events.map((event) => event.ipAddress)).size,
    uniqueUsers: new Set(events.map((event) => event.userId).filter(Boolean)).size,
    criticalEvents: events
      .filter((event) => event.severity === 'CRITICAL')
      .map((event) => ({
        type: event.eventType,
        severity: event.severity,
        timestamp: event.createdAt,
        details: event.details,
      })),
  };

  return report;
}

export async function sendSecurityReport(
  report: SecurityReport,
  recipients: string[]
): Promise<void> {
  try {
    await Promise.all(
      recipients.map((recipient) =>
        resend.emails.send({
          from: 'Security Reports <security@yourdomain.com>',
          to: recipient,
          subject: `${report.period} Security Report`,
          html: `
            <h2>${report.period} Security Report</h2>
            <p><strong>Period:</strong> ${report.period}</p>
            <p><strong>Total Events:</strong> ${report.totalEvents}</p>
            
            <h3>Events by Type</h3>
            <ul>
              ${Object.entries(report.eventsByType)
                .map(([type, count]) => `<li>${type}: ${count}</li>`)
                .join('')}
            </ul>
            
            <h3>Events by Severity</h3>
            <ul>
              ${Object.entries(report.eventsBySeverity)
                .map(([severity, count]) => `<li>${severity}: ${count}</li>`)
                .join('')}
            </ul>
            
            <p><strong>Suspicious Activities:</strong> ${report.suspiciousActivities}</p>
            <p><strong>Unique IPs:</strong> ${report.uniqueIPs}</p>
            <p><strong>Unique Users:</strong> ${report.uniqueUsers}</p>
            
            ${report.criticalEvents.length > 0 ? `
              <h3>Critical Events</h3>
              <ul>
                ${report.criticalEvents
                  .map(
                    (event) => `
                    <li>
                      <strong>${event.type}</strong> (${event.severity})
                      <br>
                      Time: ${event.timestamp.toISOString()}
                      <br>
                      Details: ${JSON.stringify(event.details, null, 2)}
                    </li>
                  `
                  )
                  .join('')}
              </ul>
            ` : ''}
          `,
        })
      )
    );
  } catch (error) {
    console.error('Failed to send security report:', error);
  }
} 