import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/webhook-service';
import { z } from 'zod';

// Schema for creating a webhook endpoint
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional(),
});

// Schema for updating a webhook endpoint
const updateWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.string()).min(1, 'At least one event is required').optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    
    // Check user role and permissions
    const isAdmin = session.user.role === 'ADMIN';
    
    // If not admin, verify organization access
    if (!isAdmin && organizationId) {
      const userOrgs = await prisma.userOrganization.findMany({
        where: {
          userId: session.user.id,
          organizationId: organizationId,
        },
      });
      
      if (userOrgs.length === 0) {
        return new NextResponse('Access denied to this organization', { status: 403 });
      }
    }
    
    // Build query filters
    const filters: any = {};
    
    if (organizationId) {
      filters.organizationId = organizationId;
    } else if (!isAdmin) {
      // If not admin and no organization specified, get all user's organizations
      const userOrgs = await prisma.userOrganization.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          organizationId: true,
        },
      });
      
      filters.organizationId = {
        in: userOrgs.map(org => org.organizationId),
      };
    }
    
    // Get webhook endpoints
    const webhooks = await prisma.webhookEndpoint.findMany({
      where: filters,
      select: {
        id: true,
        organizationId: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        // Exclude secretKey for security
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Add available events to response
    const availableEvents = WebhookService.getAvailableWebhookEvents();
    
    return NextResponse.json({
      webhooks,
      availableEvents,
    });
  } catch (error) {
    console.error('Error fetching webhook endpoints:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    
    // Validate request data
    const result = createWebhookSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { errors: result.error.format() },
        { status: 400 }
      );
    }
    
    const { name, url, events, isActive, metadata } = result.data;
    const organizationId = body.organizationId;
    
    // Verify organization access
    if (session.user.role !== 'ADMIN') {
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId: organizationId,
          role: {
            in: ['OWNER', 'ADMIN'], // Only owner and admin can create webhooks
          },
        },
      });
      
      if (!userOrg) {
        return new NextResponse('Insufficient permissions', { status: 403 });
      }
    }
    
    // Verify events are valid
    const availableEvents = WebhookService.getAvailableWebhookEvents();
    const invalidEvents = events.filter(event => !availableEvents.includes(event));
    
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid events', 
          invalidEvents 
        },
        { status: 400 }
      );
    }
    
    // Create webhook endpoint
    const webhook = await WebhookService.createWebhookEndpoint({
      organizationId,
      name,
      url,
      events,
      isActive,
      metadata,
    });
    
    // Return response with webhook data
    return NextResponse.json({
      id: webhook.id,
      organizationId: webhook.organizationId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      secretKey: webhook.secretKey, // Include secret key only on creation
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook endpoint:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 