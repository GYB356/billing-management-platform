import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { hasPermission, Permission } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SecurityEventSchema = z.object({
  type: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  metadata: z.record(z.any()),
});

const ActivityLogSchema = z.object({
  userId: z.string(),
  action: z.string(),
  resource: z.string(),
  details: z.record(z.any()).optional(),
  organizationId: z.string(),
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

  async logActivityEvent(data: z.infer<typeof ActivityLogSchema>) {
    try {
      const validatedData = ActivityLogSchema.parse(data);
      await prisma.activityLog.create({
        data: {
          ...validatedData,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      throw new Error('Activity logging failed');
    }
  }

  async checkPermission(userId: string, permission: Permission): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) return false;

    // Check user's system role and organization role permissions
    return user.organizations.some(membership => 
      hasPermission(
        user.role,
        membership.role,
        permission
      )
    );
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
      // Check if user has permission to make privacy requests
      const hasAccess = await this.checkPermission(userId, 'manage:settings');
      if (!hasAccess) {
        throw new Error('Insufficient permissions for data privacy request');
      }

      const request = await prisma.dataPrivacyRequest.create({
        data: {
          userId,
          type,
          regulation,
          status: 'PENDING',
          metadata: {},
        },
      });

      // Log the privacy request activity
      await this.logActivityEvent({
        userId,
        action: 'CREATE_PRIVACY_REQUEST',
        resource: 'privacy_request',
        details: { requestId: request.id, type, regulation },
        organizationId: (await this.getUserOrganization(userId))?.id || '',
      });

      await this.queueDataPrivacyRequest(request.id);
      return request;
    } catch (error) {
      console.error('Failed to create data privacy request:', error);
      throw new Error('Data privacy request creation failed');
    }
  }

  private async getUserOrganization(userId: string) {
    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId },
      include: { organization: true },
    });
    return userOrg?.organization;
  }

  private async queueDataPrivacyRequest(requestId: string) {
    // Implementation remains the same
    console.log(`Queued data privacy request: ${requestId}`);
  }

  async getSecurityAlerts(status?: string, organizationId?: string) {
    const session = await getServerSession();
    if (!session?.user) throw new Error('Unauthorized');

    // Check if user has permission to view security alerts
    const hasAccess = await this.checkPermission(session.user.id, 'view:settings');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to view security alerts');
    }

    return prisma.securityAlert.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getUserDataPrivacyRequests(userId: string) {
    const hasAccess = await this.checkPermission(userId, 'view:settings');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to view privacy requests');
    }

    return prisma.dataPrivacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivityLogs(organizationId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
  }) {
    const session = await getServerSession();
    if (!session?.user) throw new Error('Unauthorized');

    // Check if user has permission to view activity logs
    const hasAccess = await this.checkPermission(session.user.id, 'view:analytics');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to view activity logs');
    }

    return prisma.activityLog.findMany({
      where: {
        organizationId,
        ...(filters?.startDate && { timestamp: { gte: filters.startDate } }),
        ...(filters?.endDate && { timestamp: { lte: filters.endDate } }),
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.action && { action: filters.action }),
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}

export const securityMonitoring = new SecurityMonitoringService();