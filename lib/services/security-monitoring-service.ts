import { AuditService } from './audit-service';
import { prisma } from '@/lib/prisma';

export enum SecurityEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum SecurityEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  PAYMENT = 'PAYMENT',
  CONFIGURATION = 'CONFIGURATION',
  COMPLIANCE = 'COMPLIANCE'
}

interface SecurityAlert {
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  message: string;
  metadata: Record<string, any>;
}

export class SecurityMonitoringService {
  private auditService: AuditService;
  private alertThresholds: Map<SecurityEventType, number>;

  constructor() {
    this.auditService = new AuditService();
    this.alertThresholds = new Map([
      [SecurityEventType.AUTHENTICATION, 5],
      [SecurityEventType.AUTHORIZATION, 3],
      [SecurityEventType.PAYMENT, 2],
      [SecurityEventType.COMPLIANCE, 1]
    ]);
  }

  async monitorSecurityEvent(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    metadata: Record<string, any>
  ) {
    // Log the security event
    await this.auditService.log({
      action: 'SECURITY_EVENT',
      resourceType: 'SECURITY',
      resourceId: metadata.resourceId || 'system',
      userId: metadata.userId,
      metadata: {
        eventType,
        severity,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    // Store security event
    await prisma.securityEvent.create({
      data: {
        type: eventType,
        severity,
        metadata: metadata,
        timestamp: new Date()
      }
    });

    // Check for alert conditions
    await this.checkAlertConditions(eventType, metadata);
  }

  private async checkAlertConditions(
    eventType: SecurityEventType,
    metadata: Record<string, any>
  ) {
    const threshold = this.alertThresholds.get(eventType) || 5;
    const timeWindow = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes

    // Count recent events of the same type
    const recentEvents = await prisma.securityEvent.count({
      where: {
        type: eventType,
        timestamp: {
          gte: timeWindow
        },
        ...(metadata.userId ? { metadata: { path: ['userId'], equals: metadata.userId } } : {})
      }
    });

    if (recentEvents >= threshold) {
      await this.createSecurityAlert({
        eventType,
        severity: SecurityEventSeverity.CRITICAL,
        message: `Threshold exceeded for ${eventType} events`,
        metadata: {
          recentEvents,
          threshold,
          timeWindow: '15 minutes',
          ...metadata
        }
      });
    }
  }

  private async createSecurityAlert(alert: SecurityAlert) {
    // Log the alert
    await this.auditService.log({
      action: 'SECURITY_ALERT',
      resourceType: 'SECURITY',
      resourceId: 'alert',
      metadata: {
        ...alert,
        timestamp: new Date().toISOString()
      }
    });

    // Store the alert
    await prisma.securityAlert.create({
      data: {
        type: alert.eventType,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata,
        timestamp: new Date(),
        status: 'OPEN'
      }
    });

    // TODO: Implement notification system integration here
    // This could send emails, Slack messages, or integrate with a SIEM system
  }

  async getSecurityMetrics(timeWindow: Date) {
    const metrics = await prisma.$transaction([
      // Count events by type
      prisma.securityEvent.groupBy({
        by: ['type'],
        where: {
          timestamp: {
            gte: timeWindow
          }
        },
        _count: true
      }),

      // Count events by severity
      prisma.securityEvent.groupBy({
        by: ['severity'],
        where: {
          timestamp: {
            gte: timeWindow
          }
        },
        _count: true
      }),

      // Count open alerts
      prisma.securityAlert.count({
        where: {
          status: 'OPEN'
        }
      })
    ]);

    return {
      eventsByType: metrics[0],
      eventsBySeverity: metrics[1],
      openAlerts: metrics[2],
      timeWindow: timeWindow.toISOString()
    };
  }

  async getComplianceReport(startDate: Date, endDate: Date) {
    const events = await prisma.securityEvent.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        type: SecurityEventType.COMPLIANCE
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    const alerts = await prisma.securityAlert.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        type: SecurityEventType.COMPLIANCE
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      complianceEvents: events,
      complianceAlerts: alerts,
      summary: {
        totalEvents: events.length,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === SecurityEventSeverity.CRITICAL).length
      }
    };
  }
}