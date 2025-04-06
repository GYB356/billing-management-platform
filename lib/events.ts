import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { headers } from 'next/headers';

// Enum for event types
export enum EventType {
  // Tax-related events
  TAX_RATE_CREATED = 'TAX_RATE_CREATED',
  TAX_RATE_UPDATED = 'TAX_RATE_UPDATED',
  TAX_RATE_DELETED = 'TAX_RATE_DELETED',
  TAX_RATE_CACHE_CLEARED = 'TAX_RATE_CACHE_CLEARED',
  TAX_RULE_CREATED = 'TAX_RULE_CREATED',
  TAX_RULE_UPDATED = 'TAX_RULE_UPDATED',
  TAX_RULE_DELETED = 'TAX_RULE_DELETED',
  TAX_EXEMPTION_CREATED = 'TAX_EXEMPTION_CREATED',
  TAX_EXEMPTION_UPDATED = 'TAX_EXEMPTION_UPDATED',
  TAX_EXEMPTION_REVOKED = 'TAX_EXEMPTION_REVOKED',
  TAX_EXEMPTION_EXPIRING = 'TAX_EXEMPTION_EXPIRING',
  TAX_ID_VALIDATION = 'TAX_ID_VALIDATION',
  TAX_CALCULATION = 'TAX_CALCULATION',
  TAX_REPORT_GENERATED = 'TAX_REPORT_GENERATED',
}

// Enum for event severity levels
export enum EventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Interface for createEvent parameters
export interface CreateEventParams {
  eventType: EventType;
  resourceType: string;
  resourceId: string;
  severity?: EventSeverity;
  metadata?: Record<string, any>;
  organizationId?: string;
  userId?: string;
}

/**
 * Creates a new event in the system
 */
export async function createEvent(params: CreateEventParams) {
  try {
    // Destructure params
    const {
      organizationId,
      userId,
      eventType,
      resourceType,
      resourceId,
      metadata = {},
      severity = EventSeverity.INFO
    } = params;

    // If no user ID is provided, try to get it from the session
    let userIdToUse = userId;
    
    if (!userIdToUse) {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
          userIdToUse = session.user.id;
        }
      } catch (error) {
        // Continue without user ID if session cannot be retrieved
        console.log('Could not get user from session:', error);
      }
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        eventType,
        resourceType,
        resourceId,
        organizationId,
        userId: userIdToUse,
        metadata,
        severity,
      },
    });

    // Process event for webhooks (using dynamic import to avoid circular dependencies)
    if (organizationId) {
      try {
        // Dynamically import the webhook service to avoid circular dependencies
        const { processEventForWebhooks } = await import('./services/event-webhook-service');
        
        // Process the event asynchronously
        processEventForWebhooks(event.id).catch(error => {
          console.error('Error processing webhook for event:', error);
        });
      } catch (error) {
        console.error('Error importing webhook service:', error);
      }
    }

    return event;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

/**
 * Gets events for an organization
 */
export async function getEventsForOrganization(
  organizationId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: string[];
    resourceTypes?: string[];
    resourceIds?: string[];
    startDate?: Date;
    endDate?: Date;
    severity?: EventSeverity[];
  } = {}
) {
  const {
    limit = 100,
    offset = 0,
    eventTypes,
    resourceTypes,
    resourceIds,
    startDate,
    endDate,
    severity,
  } = options;

  // Build query
  const where: any = { organizationId };

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  if (resourceTypes && resourceTypes.length > 0) {
    where.resourceType = { in: resourceTypes };
  }

  if (resourceIds && resourceIds.length > 0) {
    where.resourceId = { in: resourceIds };
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  if (severity && severity.length > 0) {
    where.severity = { in: severity };
  }

  // Execute query
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    meta: {
      total,
      limit,
      offset,
    },
  };
}

/**
 * Gets events for a user
 */
export async function getEventsForUser(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: string[];
    resourceTypes?: string[];
    resourceIds?: string[];
    startDate?: Date;
    endDate?: Date;
    severity?: EventSeverity[];
  } = {}
) {
  const {
    limit = 100,
    offset = 0,
    eventTypes,
    resourceTypes,
    resourceIds,
    startDate,
    endDate,
    severity,
  } = options;

  // Build query
  const where: any = { userId };

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  if (resourceTypes && resourceTypes.length > 0) {
    where.resourceType = { in: resourceTypes };
  }

  if (resourceIds && resourceIds.length > 0) {
    where.resourceId = { in: resourceIds };
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  if (severity && severity.length > 0) {
    where.severity = { in: severity };
  }

  // Execute query
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    meta: {
      total,
      limit,
      offset,
    },
  };
}

/**
 * Gets events for a specific resource
 */
export async function getEventsForResource(
  resourceType: string,
  resourceId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: string[];
    startDate?: Date;
    endDate?: Date;
    severity?: EventSeverity[];
  } = {}
) {
  const {
    limit = 100,
    offset = 0,
    eventTypes,
    startDate,
    endDate,
    severity,
  } = options;

  // Build query
  const where: any = {
    resourceType,
    resourceId,
  };

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  if (severity && severity.length > 0) {
    where.severity = { in: severity };
  }

  // Execute query
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    meta: {
      total,
      limit,
      offset,
    },
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