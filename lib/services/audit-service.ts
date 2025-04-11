import { prisma } from '@/lib/prisma';

interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Log an audit event
   */
  public async log(entry: AuditLogEntry) {
    const {
      action,
      resourceType,
      resourceId,
      userId,
      changes,
      metadata,
      ipAddress,
      userAgent
    } = entry;

    return prisma.auditLog.create({
      data: {
        action,
        resourceType,
        resourceId,
        userId,
        changes,
        metadata,
        ipAddress,
        userAgent,
        timestamp: new Date()
      }
    });
  }

  /**
   * Get audit log entries with filtering
   */
  public async getAuditLogs(params: {
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    action?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      resourceType,
      resourceId,
      userId,
      action,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = params;

    return prisma.auditLog.findMany({
      where: {
        ...(resourceType ? { resourceType } : {}),
        ...(resourceId ? { resourceId } : {}),
        ...(userId ? { userId } : {}),
        ...(action ? { action: { in: action } } : {}),
        ...(startDate || endDate ? {
          timestamp: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        } : {})
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Get audit trail for a specific resource
   */
  public async getResourceAuditTrail(
    resourceType: string,
    resourceId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    return prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Get audit summary for a time period
   */
  public async getAuditSummary(startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Group by action
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by resource type
    const resourceTypeCounts = logs.reduce((acc, log) => {
      acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by user
    const userCounts = logs.reduce((acc, log) => {
      if (log.userId) {
        acc[log.userId] = (acc[log.userId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: logs.length,
      actionCounts,
      resourceTypeCounts,
      userCounts,
      timeRange: {
        start: startDate,
        end: endDate
      }
    };
  }

  /**
   * Get changes made to a resource over time
   */
  public async getResourceChangeHistory(
    resourceType: string,
    resourceId: string
  ) {
    const logs = await prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
        changes: {
          not: null
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return logs.map(log => ({
      timestamp: log.timestamp,
      user: log.user,
      action: log.action,
      changes: log.changes,
      metadata: log.metadata
    }));
  }

  /**
   * Get user activity history
   */
  public async getUserActivityHistory(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = options;

    return prisma.auditLog.findMany({
      where: {
        userId,
        ...(startDate || endDate ? {
          timestamp: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        } : {})
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset
    });
  }

  /**
   * Get sensitive operation logs
   */
  public async getSensitiveOperationLogs(
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = options;

    const sensitiveActions = [
      'DELETE',
      'PERMISSION_CHANGE',
      'ROLE_CHANGE',
      'API_KEY_GENERATED',
      'PASSWORD_CHANGE',
      'BILLING_INFO_CHANGE',
      'SUBSCRIPTION_CANCEL'
    ];

    return prisma.auditLog.findMany({
      where: {
        action: {
          in: sensitiveActions
        },
        ...(startDate || endDate ? {
          timestamp: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        } : {})
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Export audit logs
   */
  public async exportAuditLogs(
    format: 'CSV' | 'JSON',
    filters: {
      startDate?: Date;
      endDate?: Date;
      resourceType?: string;
      userId?: string;
      action?: string[];
    } = {}
  ) {
    const logs = await this.getAuditLogs({
      ...filters,
      limit: 1000000 // High limit for export
    });

    if (format === 'CSV') {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'timestamp',
      'action',
      'resourceType',
      'resourceId',
      'userId',
      'userEmail',
      'ipAddress',
      'userAgent',
      'changes',
      'metadata'
    ].join(',');

    const rows = logs.map(log => [
      log.timestamp,
      log.action,
      log.resourceType,
      log.resourceId,
      log.userId,
      log.user?.email || '',
      log.ipAddress || '',
      log.userAgent || '',
      JSON.stringify(log.changes || {}),
      JSON.stringify(log.metadata || {})
    ].join(','));

    return [headers, ...rows].join('\n');
  }
}