import { prisma } from "./prisma";
import { auth } from "./auth";
import { headers } from "next/headers";

// Interface for creating an event
interface CreateEventParams {
  organizationId?: string;
  userId?: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: EventSeverity;
}

// Event severity levels
export enum EventSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

/**
 * Create an audit event
 */
export async function createEvent({
  organizationId,
  userId,
  eventType,
  resourceType,
  resourceId,
  metadata = {},
  ipAddress,
  userAgent,
  severity = EventSeverity.INFO,
}: CreateEventParams) {
  // Try to get the current user if not provided
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id;
  }

  // Try to get request information if not provided
  if (!ipAddress || !userAgent) {
    const headersList = headers();
    ipAddress = ipAddress || headersList.get("x-forwarded-for") || 
                            headersList.get("x-real-ip") || 
                            "unknown";
    userAgent = userAgent || headersList.get("user-agent") || "unknown";
  }

  // Add request information to metadata
  const eventMetadata = {
    ...metadata,
    request: {
      ipAddress,
      userAgent,
    }
  };

  // Create the event
  const event = await prisma.event.create({
    data: {
      organizationId,
      userId,
      eventType,
      resourceType,
      resourceId,
      severity,
      metadata: eventMetadata,
    },
  });

  return event;
}

/**
 * Get events for an organization
 */
export async function getOrganizationEvents(
  organizationId: string,
  limit: number = 50,
  offset: number = 0,
  filters?: {
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    severity?: EventSeverity;
    startDate?: Date;
    endDate?: Date;
  }
) {
  // Build the where clause
  const where: any = {
    organizationId,
  };

  // Add optional filters
  if (filters) {
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }
  }

  // Get the events
  const events = await prisma.event.findMany({
    where,
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    skip: offset,
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

  // Get the total count
  const totalCount = await prisma.event.count({
    where,
  });

  return {
    events,
    totalCount,
  };
}

/**
 * Get events for a user
 */
export async function getUserEvents(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  filters?: {
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    severity?: EventSeverity;
    startDate?: Date;
    endDate?: Date;
  }
) {
  // Build the where clause
  const where: any = {
    userId,
  };

  // Add optional filters
  if (filters) {
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }
  }

  // Get the events
  const events = await prisma.event.findMany({
    where,
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    skip: offset,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get the total count
  const totalCount = await prisma.event.count({
    where,
  });

  return {
    events,
    totalCount,
  };
}

/**
 * Get events for a specific resource
 */
export async function getResourceEvents(
  resourceType: string,
  resourceId: string,
  limit: number = 50,
  offset: number = 0,
  filters?: {
    eventType?: string;
    severity?: EventSeverity;
    startDate?: Date;
    endDate?: Date;
  }
) {
  // Build the where clause
  const where: any = {
    resourceType,
    resourceId,
  };

  // Add optional filters
  if (filters) {
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }
  }

  // Get the events
  const events = await prisma.event.findMany({
    where,
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get the total count
  const totalCount = await prisma.event.count({
    where,
  });

  return {
    events,
    totalCount,
  };
}

/**
 * Get a summary of events by type for an organization
 */
export async function getOrganizationEventSummary(
  organizationId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await prisma.$queryRaw`
    SELECT 
      "eventType", 
      COUNT(*) as count
    FROM 
      events
    WHERE 
      "organizationId" = ${organizationId}
      AND "timestamp" >= ${startDate}
    GROUP BY 
      "eventType"
    ORDER BY 
      count DESC
  `;

  return events;
}

/**
 * Create an event middleware for automatic audit logging
 */
export function createAuditMiddleware(options: {
  resourceType: string;
  getResourceId: (req: Request) => string | Promise<string>;
  getEventType: (req: Request, method: string) => string;
  getUserId?: (req: Request) => string | Promise<string> | null;
  getOrganizationId?: (req: Request) => string | Promise<string> | null;
  getMetadata?: (req: Request) => Record<string, any> | Promise<Record<string, any>>;
  getSeverity?: (req: Request, method: string) => EventSeverity;
}) {
  return async function auditMiddleware(req: Request) {
    try {
      const method = req.method;
      const eventType = options.getEventType(req, method);
      const resourceId = await options.getResourceId(req);
      
      // Skip if no resource ID was determined (e.g., for listing endpoints)
      if (!resourceId) return;
      
      const userId = options.getUserId ? await options.getUserId(req) : null;
      const organizationId = options.getOrganizationId ? await options.getOrganizationId(req) : null;
      const metadata = options.getMetadata ? await options.getMetadata(req) : {};
      
      const headersList = headers();
      const ipAddress = headersList.get("x-forwarded-for") || 
                        headersList.get("x-real-ip") || 
                        "unknown";
      const userAgent = headersList.get("user-agent") || "unknown";
      
      // Determine severity based on HTTP method and custom logic
      let severity = EventSeverity.INFO;
      if (options.getSeverity) {
        severity = options.getSeverity(req, method);
      } else {
        // Default severity based on method
        if (method === 'DELETE') {
          severity = EventSeverity.WARNING;
        } else if (method === 'PATCH' || method === 'PUT') {
          severity = EventSeverity.INFO;
        }
      }
      
      await createEvent({
        userId: userId || undefined,
        organizationId: organizationId || undefined,
        eventType,
        resourceType: options.resourceType,
        resourceId,
        metadata,
        ipAddress,
        userAgent,
        severity,
      });
    } catch (error) {
      console.error("Error in audit middleware:", error);
      // Don't block the request even if auditing fails
    }
  };
} 