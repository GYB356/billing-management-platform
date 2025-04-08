import { prisma } from "@/lib/db";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.password_changed"
  | "user.2fa_enabled"
  | "user.2fa_disabled"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.deleted"
  | "payment.processed"
  | "payment.refunded"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "tax_rate.created"
  | "tax_rate.updated"
  | "tax_rate.deleted"
  | "admin.settings_changed"
  | "admin.user_role_changed"
  | "webhook.created"
  | "webhook.deleted"
  | "api_key.created"
  | "api_key.revoked";

export interface AuditLogOptions {
  userId: string;
  action: AuditAction;
  targetId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit({
  userId,
  action,
  targetId,
  description,
  metadata = {},
  ipAddress,
  userAgent
}: AuditLogOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetId,
        description,
        metadata,
        ipAddress,
        userAgent,
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Optionally, you might want to throw the error or handle it differently
    // depending on your application's needs
  }
}

export async function getAuditLogs({
  userId,
  action,
  startDate,
  endDate,
  limit = 50,
  offset = 0
}: {
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where = {
    ...(userId && { userId }),
    ...(action && { action }),
    ...(startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate })
      }
    }
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })
  ]);

  return {
    logs,
    total,
    hasMore: total > offset + limit
  };
}

// Middleware to automatically include request information
export function createAuditLogMiddleware() {
  return async function auditLogMiddleware(
    req: any,
    res: any,
    next: () => void
  ) {
    const originalEnd = res.end;
    const originalJson = res.json;

    // Extend res.json to capture the response body
    res.json = function(body: any) {
      res.body = body;
      return originalJson.apply(res, arguments);
    };

    // Extend res.end to log after response is sent
    res.end = function() {
      const result = originalEnd.apply(res, arguments);

      // Only log for specific routes or methods that need auditing
      if (shouldAuditRequest(req)) {
        const userId = req.session?.user?.id;
        if (userId) {
          logAudit({
            userId,
            action: determineAction(req),
            targetId: determineTargetId(req),
            description: generateDescription(req, res),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              responseBody: res.body
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          }).catch(console.error); // Handle any logging errors
        }
      }

      return result;
    };

    next();
  };
}

// Helper functions for the middleware
function shouldAuditRequest(req: any): boolean {
  // Define paths and methods that should be audited
  const auditPaths = [
    '/api/auth',
    '/api/invoices',
    '/api/payments',
    '/api/subscriptions',
    '/api/admin'
  ];

  return auditPaths.some(path => req.path.startsWith(path));
}

function determineAction(req: any): AuditAction {
  const path = req.path;
  const method = req.method;

  // Map paths and methods to audit actions
  if (path.startsWith('/api/auth')) {
    if (path.includes('login')) return 'user.login';
    if (path.includes('logout')) return 'user.logout';
  }

  if (path.startsWith('/api/invoices')) {
    if (method === 'POST') return 'invoice.created';
    if (method === 'PUT') return 'invoice.updated';
    if (method === 'DELETE') return 'invoice.deleted';
  }

  // Add more mappings as needed
  return 'admin.settings_changed'; // Default action
}

function determineTargetId(req: any): string | undefined {
  // Extract target ID from request path or body
  const pathParts = req.path.split('/');
  return pathParts[pathParts.length - 1];
}

function generateDescription(req: any, res: any): string {
  const method = req.method;
  const path = req.path;
  const status = res.statusCode;

  return `${method} ${path} - Status: ${status}`;
} 