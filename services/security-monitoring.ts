import { PrismaClient, SecurityEventSeverity, SecurityAlertStatus } from '@prisma/client';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

export class SecurityMonitoringService {
  async logSecurityEvent(type: string, severity: SecurityEventSeverity, metadata: any) {
    try {
      const event = await prisma.securityEvent.create({
        data: {
          type,
          severity,
          metadata
        }
      });
      
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        await this.createSecurityAlert(type, severity, 'High severity security event detected', metadata);
      }
      
      return event;
    } catch (error) {
      logger.error('Failed to log security event', { error, type, severity });
      throw error;
    }
  }

  async createSecurityAlert(
    type: string,
    severity: SecurityEventSeverity,
    message: string,
    metadata: any
  ) {
    try {
      return await prisma.securityAlert.create({
        data: {
          type,
          severity,
          message,
          metadata,
          status: SecurityAlertStatus.OPEN
        }
      });
    } catch (error) {
      logger.error('Failed to create security alert', { error, type, severity });
      throw error;
    }
  }

  async updateAlertStatus(alertId: string, status: SecurityAlertStatus) {
    try {
      return await prisma.securityAlert.update({
        where: { id: alertId },
        data: { status }
      });
    } catch (error) {
      logger.error('Failed to update alert status', { error, alertId, status });
      throw error;
    }
  }

  async getActiveAlerts() {
    try {
      return await prisma.securityAlert.findMany({
        where: {
          status: {
            in: [SecurityAlertStatus.OPEN, SecurityAlertStatus.IN_PROGRESS]
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
    } catch (error) {
      logger.error('Failed to fetch active alerts', { error });
      throw error;
    }
  }

  async getSecurityEvents(startDate: Date, endDate: Date) {
    try {
      return await prisma.securityEvent.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
    } catch (error) {
      logger.error('Failed to fetch security events', { error, startDate, endDate });
      throw error;
    }
  }
}