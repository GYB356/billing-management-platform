import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/webhook-service';
import { z } from 'zod';

// Schema for updating a webhook endpoint
const updateWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.string()).min(1, 'At least one event is required').optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// Check if user has permission to access webhook
async function checkWebhookPermission(webhookId: string, userId: string, isAdmin: boolean) {
  // Get webhook endpoint
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id: webhookId },
  });
  
  if (!webhook) {
    return { webhook: null, hasPermission: false };
  }
  
  // Admin has access to all webhooks
  if (isAdmin) {
    return { webhook, hasPermission: true };
  }
  
  // Check organization access
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId,
      organizationId: webhook.organizationId,
      role: {
        in: ['OWNER', 'ADMIN'], // Only owner and admin can manage webhooks
      },
    },
  });
  
  return { webhook, hasPermission: !!userOrg };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check permissions
    const { webhook, hasPermission } = await checkWebhookPermission(
      params.id,
      session.user.id,
      session.user.role === 'ADMIN'
    );
    
    if (!webhook) {
      return new NextResponse('Webhook not found', { status: 404 });
    }
    
    if (!hasPermission) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    // Return webhook data (excluding secretKey)
    return NextResponse.json({
      id: webhook.id,
      organizationId: webhook.organizationId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      metadata: webhook.metadata,
    });
  } catch (error) {
    console.error('Error fetching webhook endpoint:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check permissions
    const { webhook, hasPermission } = await checkWebhookPermission(
      params.id,
      session.user.id,
      session.user.role === 'ADMIN'
    );
    
    if (!webhook) {
      return new NextResponse('Webhook not found', { status: 404 });
    }
    
    if (!hasPermission) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate request data
    const result = updateWebhookSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { errors: result.error.format() },
        { status: 400 }
      );
    }
    
    // Verify events are valid if provided
    if (body.events) {
      const availableEvents = WebhookService.getAvailableWebhookEvents();
      const invalidEvents = body.events.filter(event => !availableEvents.includes(event));
      
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { 
            error: 'Invalid events', 
            invalidEvents 
          },
          { status: 400 }
        );
      }
    }
    
    // Update webhook endpoint
    const updatedWebhook = await WebhookService.updateWebhookEndpoint(
      params.id,
      result.data
    );
    
    // Return updated webhook data
    return NextResponse.json({
      id: updatedWebhook.id,
      organizationId: updatedWebhook.organizationId,
      name: updatedWebhook.name,
      url: updatedWebhook.url,
      events: updatedWebhook.events,
      isActive: updatedWebhook.isActive,
      createdAt: updatedWebhook.createdAt,
      updatedAt: updatedWebhook.updatedAt,
      metadata: updatedWebhook.metadata,
    });
  } catch (error) {
    console.error('Error updating webhook endpoint:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check permissions
    const { webhook, hasPermission } = await checkWebhookPermission(
      params.id,
      session.user.id,
      session.user.role === 'ADMIN'
    );
    
    if (!webhook) {
      return new NextResponse('Webhook not found', { status: 404 });
    }
    
    if (!hasPermission) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    // Delete webhook endpoint
    await WebhookService.deleteWebhookEndpoint(params.id);
    
    // Return success response
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting webhook endpoint:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 