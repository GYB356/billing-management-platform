import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SecurityEventSchema = z.object({
  type: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  metadata: z.record(z.any()),
});

export class SecurityMonitoringService {
  async logSecurityEvent(event: z.infer<typeof SecurityEventSchema>) {
    try {
      const validatedEvent = SecurityEventSchema.parse(event);
      await prisma.securityEvent.create({
        data: {
          ...validatedEvent,
          timestamp: new Date(),
        },
      });

      if (['HIGH', 'CRITICAL'].includes(validatedEvent.severity)) {
        await this.createSecurityAlert(validatedEvent);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      throw new Error('Security event logging failed');
    }
  }

  private async createSecurityAlert(event: z.infer<typeof SecurityEventSchema>) {
    await prisma.securityAlert.create({
      data: {
        type: event.type,
        severity: event.severity,
        message: `Security alert: ${event.type}`,
        metadata: event.metadata,
        status: 'OPEN',
      },
    });
  }

  async handleDataPrivacyRequest(userId: string, type: 'ACCESS' | 'DELETE' | 'MODIFY', regulation: 'GDPR' | 'CCPA') {
    try {
      const request = await prisma.dataPrivacyRequest.create({
        data: {
          userId,
          type,
          regulation,
          status: 'PENDING',
          metadata: {},
        },
      });

      // Queue processing of the request (implementation depends on your queue system)
      await this.queueDataPrivacyRequest(request.id);
      return request;
    } catch (error) {
      console.error('Failed to create data privacy request:', error);
      throw new Error('Data privacy request creation failed');
    }
  }

  private async queueDataPrivacyRequest(requestId: string) {
    // Implement queue logic here based on your infrastructure
    // This could use Redis, RabbitMQ, or other queue systems
    console.log(`Queued data privacy request: ${requestId}`);
  }

  async getSecurityAlerts(status?: string) {
    return prisma.securityAlert.findMany({
      where: status ? { status } : undefined,
      orderBy: { timestamp: 'desc' },
    });
  }

  async getUserDataPrivacyRequests(userId: string) {
    return prisma.dataPrivacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const securityMonitoring = new SecurityMonitoringService();